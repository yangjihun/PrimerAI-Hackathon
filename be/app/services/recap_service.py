from __future__ import annotations

from app.api.schemas import (
    MetaEnvelope,
    RecapPayload,
    RecapRequest,
    RecapResponse,
    ResponseStyle,
    WarningItem,
)
from app.llm.openai_client import OpenAIClient
from app.llm.prompting import load_prompt
from app.rag.evidence_select import build_evidences_from_lines
from app.rag.retrieval import resolve_lines_from_chunks, retrieve_chunks
from app.rag.validator import sanitize_evidences
from app.utils.text import summarize_lines

try:
    from langsmith import traceable
except Exception:  # pragma: no cover - optional dependency at runtime
    def traceable(*args, **kwargs):  # type: ignore[no-redef]
        def _decorator(func):
            return func
        return _decorator


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
        return 'Use a film-critic tone. Emphasize pacing, tension, and character arcs.'
    return (
        'Use a friendly conversational tone, warm and approachable. '
        'If output language is Korean, speak in casual banmal style.'
    )


@traceable(name='recap_pipeline', run_type='chain')
def build_recap(db, req: RecapRequest) -> RecapResponse:
    warnings: list[WarningItem] = []

    query_seed = {
        'GENERAL': '지난 이야기 핵심',
        'CHARACTER_FOCUSED': '인물 중심 관계 변화',
        'CONFLICT_FOCUSED': '갈등과 의심의 흐름',
    }.get(req.mode.value if req.mode else 'GENERAL', '지난 이야기 핵심')

    chunks = retrieve_chunks(
        db,
        episode_id=req.episode_id,
        current_time_ms=req.current_time_ms,
        query=query_seed,
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
    recap_text = ''
    bullets: list[str] = []
    watch_points: list[str] = []

    if llm.enabled and lines:
        system_prompt = load_prompt('recap_prompt.txt')
        output_language = _language_instruction(req.language)
        style_instruction = _style_instruction(req.response_style)
        context_text = '\n'.join(f'[{line.start_ms}] {line.speaker_text or "?"}: {line.text}' for line in lines)
        user_prompt = (
            f'title_id={req.title_id}\nepisode_id={req.episode_id}\ncurrent_time_ms={req.current_time_ms}\n'
            f'language={req.language or "ko"}\n'
            f'response_style={(req.response_style or ResponseStyle.FRIEND).value}\n'
            f'preset={req.preset.value}\nmode={req.mode.value if req.mode else "GENERAL"}\n'
            f'Output requirement: All natural-language fields in JSON must be written in {output_language}. '
            f'Do not mix languages.\n'
            f'Style requirement: {style_instruction}\n'
            f'context:\n{context_text}'
        )
        result = llm.complete_json(system_prompt=system_prompt, user_prompt=user_prompt)
        if result:
            recap_text = str(result.get('text', '')).strip()
            bullets = [str(item) for item in result.get('bullets', [])][:4]
            watch_points = [str(item) for item in result.get('watch_points', [])][:3]

    if not recap_text:
        recap_text = summarize_lines([line.text for line in lines], max_chars=230)
        if not recap_text:
            if (req.response_style or ResponseStyle.FRIEND) == ResponseStyle.FRIEND:
                recap_text = '현재 시점 기준으로는 확실한 근거가 부족해서 짧게 정리하기 어렵네.'
            else:
                recap_text = '현재 시점 기준으로는 확실한 근거가 부족해서 짧게 정리하기 어려워요.'
        bullets = bullets or [line.text for line in lines[:3]]
        watch_points = watch_points or ['새로운 단서가 나오는지', '인물 간 신뢰 변화', '대사의 모순 여부']

    if not evidences:
        warnings.append(
            WarningItem(
                code='EVIDENCE_INSUFFICIENT',
                message='현재 시점까지의 자막에서 직접 근거를 충분히 확보하지 못했어요.',
            )
        )

    return RecapResponse(
        meta=MetaEnvelope(
            title_id=req.title_id,
            episode_id=req.episode_id,
            current_time_ms=req.current_time_ms,
            spoiler_guard_applied=True,
            model=llm.model if llm.enabled else 'rule-based',
        ),
        recap=RecapPayload(text=recap_text, bullets=bullets[:3]),
        watch_points=watch_points[:3],
        evidences=evidences,
        warnings=warnings,
    )
