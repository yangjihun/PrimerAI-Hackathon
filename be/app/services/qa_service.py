from __future__ import annotations

from sqlalchemy import select

from app.api.schemas import (
    AnswerPayload,
    GraphHighlight,
    Interpretation,
    MetaEnvelope,
    QARequest,
    QAResponse,
    RelatedGraphFocus,
    WarningItem,
)
from app.db.models import Relation
from app.llm.openai_client import OpenAIClient
from app.llm.prompting import load_prompt
from app.rag.evidence_select import build_evidences_from_lines
from app.rag.retrieval import resolve_lines_from_chunks, retrieve_chunks
from app.rag.validator import enforce_degrade_if_needed, sanitize_evidences


def _build_fallback_answer(lines) -> AnswerPayload:
    if not lines:
        return AnswerPayload(
            conclusion='현재 시점 기준으로는 확실한 근거가 부족해서 단정하긴 어려워.',
            context=['질문과 직접 연결되는 대사가 충분히 확보되지 않았어요.'],
            interpretations=[
                Interpretation(label='A', text='오해로 인한 갈등 가능성', confidence=0.35),
                Interpretation(label='B', text='배경 사건이 아직 드러나지 않았을 가능성', confidence=0.28),
            ],
            overall_confidence=0.3,
        )

    first = lines[0]
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
        context_text = '\n'.join(f'[{line.start_ms}] {line.speaker_text or "?"}: {line.text}' for line in lines)
        user_prompt = (
            f'title_id={req.title_id}\nepisode_id={req.episode_id}\ncurrent_time_ms={req.current_time_ms}\n'
            f'question={req.question}\ncontext:\n{context_text}'
        )
        result = llm.complete_json(system_prompt=system_prompt, user_prompt=user_prompt)
        if result:
            answer = AnswerPayload(
                conclusion=str(result.get('conclusion', '')).strip() or '현재 시점 기준으로는 단정이 어려워.',
                context=[str(item) for item in result.get('context', [])][:4] or ['근거를 바탕으로 제한적으로 답변합니다.'],
                interpretations=[
                    Interpretation(
                        label=str(item.get('label', 'A')),
                        text=str(item.get('text', '해석 근거 부족')),
                        confidence=float(item.get('confidence', 0.3)),
                    )
                    for item in result.get('interpretations', [])[:2]
                ]
                or [Interpretation(label='A', text='해석 근거 부족', confidence=0.3)],
                overall_confidence=float(result.get('overall_confidence', 0.5)),
            )

    if not answer:
        answer = _build_fallback_answer(lines)

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
