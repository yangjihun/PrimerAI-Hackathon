from __future__ import annotations

from sqlalchemy import delete, select

from app.api.schemas import (
    AnswerPayload,
    ChatMessageOut,
    GraphHighlight,
    Interpretation,
    MetaEnvelope,
    QARequest,
    QAResponse,
    ResponseStyle,
    RelatedGraphFocus,
    WarningItem,
)
from app.db.models import ChatMessage, ChatSession, Relation
from app.llm.openai_client import OpenAIClient
from app.llm.prompting import load_prompt
from app.core.config import get_settings
from app.rag.evidence_select import build_evidences_from_lines
from app.rag.query_intent import classify_query_intent
from app.rag.retrieval import fallback_recent_lines, resolve_lines_from_chunks, retrieve_chunks
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


def _get_or_create_chat_session(
    db,
    *,
    title_id: str,
    episode_id: str,
    user_id: str,
    current_time_ms: int,
) -> ChatSession:
    session = db.scalar(
        select(ChatSession)
        .where(
            ChatSession.title_id == title_id,
            ChatSession.episode_id == episode_id,
            ChatSession.user_id == user_id,
        )
        .order_by(ChatSession.created_at.desc())
        .limit(1)
    )
    if session:
        session.current_time_ms = current_time_ms
        return session

    session = ChatSession(
        title_id=title_id,
        episode_id=episode_id,
        user_id=user_id,
        current_time_ms=current_time_ms,
        meta={},
    )
    db.add(session)
    db.flush()
    return session


def _load_recent_chat_messages(db, *, session_id: str, limit: int) -> list[ChatMessage]:
    items = list(
        db.scalars(
            select(ChatMessage)
            .where(ChatMessage.session_id == session_id)
            .order_by(ChatMessage.created_at.desc())
            .limit(max(1, limit))
        ).all()
    )
    return list(reversed(items))


def _render_history_block(messages: list[ChatMessage]) -> str:
    if not messages:
        return ''
    lines = ['-지난 채팅 내역입니다-']
    for item in messages:
        role = '사용자' if item.role == 'user' else '어시스턴트'
        content = (item.content or '').strip().replace('\n', ' ')
        if not content:
            continue
        lines.append(f'{role}: {content[:400]}')
    if len(lines) == 1:
        return ''
    lines.append('-현재 질문입니다-')
    return '\n'.join(lines)


def _persist_chat_turn(
    db,
    *,
    session_id: str,
    current_time_ms: int,
    question: str,
    answer_text: str,
    model: str | None,
    related_relation_id: str | None = None,
) -> None:
    db.add(
        ChatMessage(
            session_id=session_id,
            role='user',
            content=question,
            current_time_ms=current_time_ms,
            model=model,
        )
    )
    db.add(
        ChatMessage(
            session_id=session_id,
            role='assistant',
            content=answer_text,
            current_time_ms=current_time_ms,
            model=model,
            related_relation_id=related_relation_id,
        )
    )


def list_chat_history(
    db,
    *,
    title_id: str,
    episode_id: str,
    user_id: str,
    limit: int = 100,
) -> list[ChatMessageOut]:
    session = db.scalar(
        select(ChatSession)
        .where(
            ChatSession.title_id == title_id,
            ChatSession.episode_id == episode_id,
            ChatSession.user_id == user_id,
        )
        .order_by(ChatSession.created_at.desc())
        .limit(1)
    )
    if session is None:
        return []

    messages = list(
        db.scalars(
            select(ChatMessage)
            .where(ChatMessage.session_id == session.id)
            .order_by(ChatMessage.created_at.asc())
            .limit(max(1, limit))
        ).all()
    )
    return [
        ChatMessageOut(
            id=item.id,
            session_id=item.session_id,
            role=item.role,
            content=item.content,
            current_time_ms=item.current_time_ms,
            model=item.model,
            prompt_tokens=item.prompt_tokens,
            completion_tokens=item.completion_tokens,
            related_relation_id=item.related_relation_id,
            created_at=item.created_at.isoformat() if item.created_at else None,
        )
        for item in messages
    ]


def clear_chat_history(
    db,
    *,
    title_id: str,
    episode_id: str,
    user_id: str,
) -> tuple[int, int]:
    sessions = list(
        db.scalars(
            select(ChatSession.id).where(
                ChatSession.title_id == title_id,
                ChatSession.episode_id == episode_id,
                ChatSession.user_id == user_id,
            )
        ).all()
    )
    if not sessions:
        return (0, 0)

    deleted_messages = db.execute(
        delete(ChatMessage).where(ChatMessage.session_id.in_(sessions))
    ).rowcount or 0
    deleted_sessions = db.execute(
        delete(ChatSession).where(ChatSession.id.in_(sessions))
    ).rowcount or 0
    db.commit()
    return (int(deleted_messages), int(deleted_sessions))


def _build_casual_answer(
    question: str,
    *,
    style: ResponseStyle | None,
    language: str | None,
) -> AnswerPayload:
    is_english = (language or '').lower().startswith('en')
    selected = style or ResponseStyle.FRIEND
    normalized = (question or '').strip().lower()

    if any(token in normalized for token in ('먹', 'menu', 'eat', '저녁', '점심', '아침')):
        if is_english:
            menu_reply = (
                "How about a simple combo: kimchi fried rice, ramen, or a chicken salad? "
                "If you want, tell me your budget and I can narrow it down."
            )
            if selected == ResponseStyle.ASSISTANT:
                menu_reply = (
                    "Recommended dinner options: 1) kimchi fried rice 2) ramen 3) chicken salad. "
                    "Share your budget or preferred flavor and I will refine the choice."
                )
            elif selected == ResponseStyle.CRITIC:
                menu_reply = (
                    "Tonight's lineup has three moods: bold kimchi fried rice, comforting ramen, "
                    "or a clean chicken salad ending."
                )
        else:
            menu_reply = "오늘 저녁은 김치볶음밥, 라면, 치킨샐러드 중에서 골라봐. 예산 알려주면 더 줄여줄게."
            if selected == ResponseStyle.ASSISTANT:
                menu_reply = (
                    "저녁 메뉴 추천: 1) 김치볶음밥 2) 라면 3) 치킨샐러드. "
                    "예산이나 선호 맛을 알려주시면 더 정확히 추천드릴게요."
                )
            elif selected == ResponseStyle.CRITIC:
                menu_reply = (
                    "오늘 저녁의 톤은 세 가지야. 강한 풍미의 김치볶음밥, 안정적인 라면, "
                    "가벼운 마무리의 치킨샐러드."
                )

        return AnswerPayload(
            conclusion=menu_reply,
            context=[
                '질문이 일상 대화로 분류되어 작품 RAG 검색 없이 답변했습니다.'
                if not is_english
                else 'Classified as casual chat and answered without episode retrieval.'
            ],
            interpretations=[
                Interpretation(
                    label='INTENT',
                    text='질문 의도: 일상 대화' if not is_english else 'Intent: casual chat',
                    confidence=0.93,
                )
            ],
            overall_confidence=0.93,
        )

    if is_english:
        if selected == ResponseStyle.ASSISTANT:
            conclusion = 'This is a casual question. I can answer directly and switch to episode-grounded mode anytime.'
            context = ['Ask with scene/character/timeline details to use subtitle evidence retrieval.']
        elif selected == ResponseStyle.CRITIC:
            conclusion = 'This reads as everyday chat, not scene analysis.'
            context = ['Ask with scene details and I can respond with evidence-driven interpretation.']
        else:
            conclusion = 'Sounds like daily chat. I am in friend mode.'
            context = ['If you ask about the episode, I will use timeline-based subtitle evidence.']
    else:
        if selected == ResponseStyle.ASSISTANT:
            conclusion = '일상 질문이라 바로 답변할게요. 작품 질문이면 근거 기반 모드로 전환할 수 있어요.'
            context = ['장면/인물/시간대를 포함해 질문하면 근거 기반 답변 모드로 전환할 수 있어요.']
        elif selected == ResponseStyle.CRITIC:
            conclusion = '이건 장면 분석보다 일상 대화에 가까워 보여.'
            context = ['장면 정보가 포함되면 근거 중심 해석으로 답변할 수 있습니다.']
        else:
            conclusion = '좋아, 일상 질문이면 이렇게 편하게 답해줄게.'
            context = ['작품 질문이면 타임라인 자막 근거를 바탕으로 다시 설명해줄게.']

    return AnswerPayload(
        conclusion=conclusion,
        context=context,
        interpretations=[
            Interpretation(
                label='INTENT',
                text='질문 의도: 일상 대화',
                confidence=0.93,
            )
        ],
        overall_confidence=0.93,
    )


def _build_casual_answer_with_llm(
    llm: OpenAIClient,
    *,
    question: str,
    history_block: str,
    style: ResponseStyle | None,
    language: str | None,
) -> AnswerPayload | None:
    if not llm.enabled:
        return None

    output_language = _language_instruction(language)
    style_instruction = _style_instruction(style)
    system_prompt = (
        "You are a friendly daily-life chat assistant.\n"
        "Return JSON with fields: conclusion (string), context (array of string, 1-2), "
        "overall_confidence (0.0-1.0).\n"
        "Do not reference episode subtitles or retrieval evidence.\n"
    )
    user_prompt = (
        f"{history_block}\n"
        f"question={question}\n"
        f"language={language or 'ko'}\n"
        f"response_style={(style or ResponseStyle.FRIEND).value}\n"
        f"Output requirement: All natural-language fields in JSON must be written in {output_language}. "
        "Do not mix languages.\n"
        f"Style requirement: {style_instruction}\n"
    )
    result = llm.complete_json(system_prompt=system_prompt, user_prompt=user_prompt)
    if not result:
        return None

    conclusion = str(result.get('conclusion', '')).strip()
    if not conclusion:
        return None

    context = [str(item).strip() for item in _as_list(result.get('context', [])) if str(item).strip()][:2]
    if not context:
        context = [
            '일상 질문으로 분류되어 작품 근거 검색 없이 답변했습니다.'
            if not (language or '').lower().startswith('en')
            else 'Classified as casual chat and answered without episode retrieval.'
        ]

    return AnswerPayload(
        conclusion=conclusion,
        context=context,
        interpretations=[
            Interpretation(
                label='INTENT',
                text='질문 의도: 일상 대화'
                if not (language or '').lower().startswith('en')
                else 'Intent: casual chat',
                confidence=0.93,
            )
        ],
        overall_confidence=_to_confidence(result.get('overall_confidence', 0.88), default=0.88),
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
def ask_question(db, req: QARequest, *, user_id: str | None = None) -> QAResponse:
    warnings: list[WarningItem] = []
    llm = OpenAIClient()
    settings = get_settings()
    session_id: str | None = None
    history_block = ''

    if user_id:
        session = _get_or_create_chat_session(
            db,
            title_id=req.title_id,
            episode_id=req.episode_id,
            user_id=user_id,
            current_time_ms=req.current_time_ms,
        )
        session_id = session.id
        history_messages = _load_recent_chat_messages(
            db,
            session_id=session.id,
            limit=settings.chat_history_window,
        )
        history_block = _render_history_block(history_messages)

    intent = classify_query_intent(req.question)
    if intent.intent == 'CASUAL':
        warnings.append(
            WarningItem(
                code='QUESTION_INTENT_CASUAL',
                message='일상 질문으로 분류되어 에피소드 RAG 검색을 생략했습니다.',
            )
        )
        casual_answer = _build_casual_answer_with_llm(
            llm,
            question=req.question,
            history_block=history_block,
            style=req.response_style,
            language=req.language,
        ) or _build_casual_answer(
            req.question,
            style=req.response_style,
            language=req.language,
        )
        response = QAResponse(
            meta=MetaEnvelope(
                title_id=req.title_id,
                episode_id=req.episode_id,
                current_time_ms=req.current_time_ms,
                spoiler_guard_applied=True,
                model=llm.model if llm.enabled else 'rule-based',
            ),
            answer=casual_answer,
            evidences=[],
            related_graph_focus=None,
            warnings=warnings,
        )
        if session_id:
            _persist_chat_turn(
                db,
                session_id=session_id,
                current_time_ms=req.current_time_ms,
                question=req.question,
                answer_text=response.answer.conclusion,
                model=llm.model if llm.enabled else 'rule-based',
            )
            db.commit()
        return response

    chunks = retrieve_chunks(
        db,
        episode_id=req.episode_id,
        current_time_ms=req.current_time_ms,
        query=intent.normalized_question or req.question,
    )
    lines = resolve_lines_from_chunks(
        db,
        episode_id=req.episode_id,
        current_time_ms=req.current_time_ms,
        chunks=chunks,
        max_lines=6,
    )
    if not lines:
        lines = fallback_recent_lines(
            db,
            episode_id=req.episode_id,
            current_time_ms=req.current_time_ms,
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

    answer = None
    if llm.enabled and lines:
        system_prompt = load_prompt('qa_prompt.txt')
        output_language = _language_instruction(req.language)
        style_instruction = _style_instruction(req.response_style)
        context_text = '\n'.join(f'[{line.start_ms}] {line.speaker_text or "?"}: {line.text}' for line in lines)
        user_prompt = (
            f'title_id={req.title_id}\nepisode_id={req.episode_id}\ncurrent_time_ms={req.current_time_ms}\n'
            f'{history_block}\n'
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

    response = QAResponse(
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
    if session_id:
        _persist_chat_turn(
            db,
            session_id=session_id,
            current_time_ms=req.current_time_ms,
            question=req.question,
            answer_text=response.answer.conclusion,
            model=llm.model if llm.enabled else 'rule-based',
            related_relation_id=relation_id,
        )
        db.commit()
    return response
