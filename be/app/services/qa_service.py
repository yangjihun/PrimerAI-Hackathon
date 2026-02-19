from __future__ import annotations

from sqlalchemy import select

from app.api.schemas import (
    AnswerPayload,
    GraphHighlight,
    Interpretation,
    MetaEnvelope,
    QARequest,
    QAResponse,
    ResponseStyle,
    RelatedGraphFocus,
    WarningItem,
)
from app.db.models import Relation
from app.llm.openai_client import OpenAIClient
from app.llm.prompting import load_prompt
from app.rag.evidence_select import build_evidences_from_lines
from app.rag.retrieval import resolve_lines_from_chunks, retrieve_chunks
from app.rag.validator import enforce_degrade_if_needed, sanitize_evidences

try:
    from langsmith import traceable
except Exception:  # pragma: no cover - optional dependency at runtime
    def traceable(*args, **kwargs):  # type: ignore[no-redef]
        def _decorator(func):
            return func
        return _decorator


def _to_confidence(value, default: float = 0.3) -> float:
    try:
        parsed = float(value)
    except (TypeError, ValueError):
        return default
    return max(0.0, min(1.0, parsed))


def _as_list(value) -> list:
    if value is None:
        return []
    if isinstance(value, list):
        return value
    if isinstance(value, tuple):
        return list(value)
    if isinstance(value, dict):
        return [value]
    return [value]


def _language_instruction(language: str | None) -> str:
    if (language or '').lower().startswith('ko'):
        return 'Korean'
    if (language or '').lower().startswith('en'):
        return 'English'
    return 'Korean'


def _style_instruction(style: ResponseStyle | None) -> str:
    selected = style or ResponseStyle.FRIEND
    if selected == ResponseStyle.ASSISTANT:
        return 'Use a concise professional assistant tone. Be polite and structured.'
    if selected == ResponseStyle.CRITIC:
        return 'Use a film-critic tone. Focus on narrative structure, tension, and character motivation.'
    return (
        'Use a friendly conversational tone, warm and approachable. '
        'If output language is Korean, speak in casual banmal style.'
    )


def _styled_defaults(style: ResponseStyle | None) -> tuple[str, str]:
    selected = style or ResponseStyle.FRIEND
    if selected == ResponseStyle.ASSISTANT:
        return (
            '현재 시점 기준으로는 근거가 제한적이라 확정적으로 판단하기 어렵습니다.',
            '확인 가능한 근거 범위에서만 정리해 드릴게요.',
        )
    if selected == ResponseStyle.CRITIC:
        return (
            '현재 시점의 단서만 보면 갈등의 동력은 보이지만 결론을 단정하기엔 이릅니다.',
            '서사의 장치와 인물 동기를 중심으로 해석해 볼 수 있습니다.',
        )
    return (
        '현재 시점 기준으로는 확실한 근거가 부족해서 단정하긴 어려워.',
        '확보된 단서 중심으로 같이 정리해보자.',
    )


def _build_fallback_answer(lines, *, style: ResponseStyle | None) -> AnswerPayload:
    default_conclusion, default_context = _styled_defaults(style)
    if not lines:
        return AnswerPayload(
            conclusion=default_conclusion,
            context=[default_context],
            interpretations=[
                Interpretation(label='A', text='오해로 인한 갈등 가능성', confidence=0.35),
                Interpretation(label='B', text='배경 사건이 아직 드러나지 않았을 가능성', confidence=0.28),
            ],
            overall_confidence=0.3,
        )

    first = lines[0]
    if (style or ResponseStyle.FRIEND) == ResponseStyle.ASSISTANT:
        conclusion = f'핵심은 {first.speaker_text or "인물"}의 최근 발언이 현재 갈등의 단서로 보인다는 점입니다.'
    elif (style or ResponseStyle.FRIEND) == ResponseStyle.CRITIC:
        conclusion = f'이 장면의 긴장은 {first.speaker_text or "인물"}의 최근 발언에서 비롯됩니다.'
    else:
        conclusion = f'핵심은 {first.speaker_text or "인물"}의 최근 발언이 갈등의 단서로 보인다는 점이야.'
    context = [f'[{line.start_ms}] {line.text}' for line in lines[:3]]
    return AnswerPayload(
        conclusion=conclusion,
        context=context,
        interpretations=[
            Interpretation(label='A', text='발언의 모순 때문에 의심이 커졌을 가능성', confidence=0.62),
            Interpretation(label='B', text='의도적 회피가 오해를 만들었을 가능성', confidence=0.46),
        ],
        overall_confidence=0.61,
    )


def _find_related_relation_id(db, req: QARequest) -> str | None:
    if req.focus and req.focus.relation_id:
        return req.focus.relation_id

    if not req.focus or not req.focus.character_ids or len(req.focus.character_ids) < 2:
        return None

    char_a, char_b = req.focus.character_ids[0], req.focus.character_ids[1]
    relation = db.scalar(
        select(Relation).where(
            Relation.title_id == req.title_id,
            Relation.from_character_id == char_a,
            Relation.to_character_id == char_b,
            Relation.valid_from_time_ms <= req.current_time_ms,
        )
    )
    if relation:
        return relation.id

    reverse = db.scalar(
        select(Relation).where(
            Relation.title_id == req.title_id,
            Relation.from_character_id == char_b,
            Relation.to_character_id == char_a,
            Relation.valid_from_time_ms <= req.current_time_ms,
        )
    )
    return reverse.id if reverse else None


@traceable(name='qa_pipeline', run_type='chain')
def ask_question(db, req: QARequest) -> QAResponse:
    warnings: list[WarningItem] = []

    chunks = retrieve_chunks(
        db,
        episode_id=req.episode_id,
        current_time_ms=req.current_time_ms,
        query=req.question,
    )
    lines = resolve_lines_from_chunks(
        db,
        episode_id=req.episode_id,
        current_time_ms=req.current_time_ms,
        chunks=chunks,
        max_lines=6,
    )

    evidences = build_evidences_from_lines(lines, max_lines_per_evidence=2)
    evidences = sanitize_evidences(
        db,
        evidences=evidences,
        episode_id=req.episode_id,
        current_time_ms=req.current_time_ms,
        warnings=warnings,
    )

    llm = OpenAIClient()
    answer = None
    if llm.enabled and lines:
        system_prompt = load_prompt('qa_prompt.txt')
        output_language = _language_instruction(req.language)
        style_instruction = _style_instruction(req.response_style)
        context_text = '\n'.join(f'[{line.start_ms}] {line.speaker_text or "?"}: {line.text}' for line in lines)
        user_prompt = (
            f'title_id={req.title_id}\nepisode_id={req.episode_id}\ncurrent_time_ms={req.current_time_ms}\n'
            f'language={req.language or "ko"}\n'
            f'response_style={(req.response_style or ResponseStyle.FRIEND).value}\n'
            f'question={req.question}\n'
            f'Output requirement: All natural-language fields in JSON must be written in {output_language}. '
            f'Do not mix languages.\n'
            f'Style requirement: {style_instruction}\n'
            f'context:\n{context_text}'
        )
        result = llm.complete_json(system_prompt=system_prompt, user_prompt=user_prompt)
        if result:
            raw_interpretations = _as_list(result.get('interpretations', []))
            parsed_interpretations: list[Interpretation] = []
            for idx, item in enumerate(raw_interpretations[:2]):
                if isinstance(item, dict):
                    parsed_interpretations.append(
                        Interpretation(
                            label=str(item.get('label', 'A')),
                            text=str(item.get('text', '해석 근거 부족')),
                            confidence=_to_confidence(item.get('confidence', 0.3)),
                        )
                    )
                elif isinstance(item, str):
                    parsed_interpretations.append(
                        Interpretation(
                            label='A' if idx == 0 else 'B',
                            text=item,
                            confidence=0.3,
                        )
                    )

            answer = AnswerPayload(
                conclusion=str(result.get('conclusion', '')).strip() or '현재 시점 기준으로는 단정이 어려워.',
                context=[str(item) for item in _as_list(result.get('context', []))][:4]
                or ['근거를 바탕으로 제한적으로 답변합니다.'],
                interpretations=parsed_interpretations
                or [Interpretation(label='A', text='해석 근거 부족', confidence=0.3)],
                overall_confidence=_to_confidence(result.get('overall_confidence', 0.5), default=0.5),
            )

    if not answer:
        answer = _build_fallback_answer(lines, style=req.response_style)

    answer = enforce_degrade_if_needed(answer, evidences, warnings)

    relation_id = _find_related_relation_id(db, req)
    related_focus = None
    if relation_id:
        related_focus = RelatedGraphFocus(
            relation_id=relation_id,
            highlight=GraphHighlight(type='RELATION', ids=[relation_id]),
        )

    return QAResponse(
        meta=MetaEnvelope(
            title_id=req.title_id,
            episode_id=req.episode_id,
            current_time_ms=req.current_time_ms,
            spoiler_guard_applied=True,
            model=llm.model if llm.enabled else 'rule-based',
        ),
        answer=answer,
        evidences=evidences,
        related_graph_focus=related_focus,
        warnings=warnings,
    )
