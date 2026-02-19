from __future__ import annotations

from enum import Enum

from pydantic import BaseModel, Field, field_validator


class WarningItem(BaseModel):
    code: str
    message: str


class ErrorResponse(BaseModel):
    code: str
    message: str
    details: dict | None = None


class Title(BaseModel):
    id: str
    name: str
    description: str | None = None
    created_at: str | None = None


class Episode(BaseModel):
    id: str
    title_id: str
    season: int
    episode_number: int
    name: str | None = None
    duration_ms: int | None = None


class PaginatedTitles(BaseModel):
    items: list[Title]
    next_cursor: str | None = None


class EvidenceLine(BaseModel):
    subtitle_line_id: str
    start_ms: int
    end_ms: int
    speaker_text: str | None = None
    text: str


class Evidence(BaseModel):
    evidence_id: str
    representative_time_ms: int
    summary: str | None = None
    lines: list[EvidenceLine]


class RecapPreset(str, Enum):
    TWENTY_SEC = 'TWENTY_SEC'
    ONE_MIN = 'ONE_MIN'
    THREE_MIN = 'THREE_MIN'


class RecapMode(str, Enum):
    GENERAL = 'GENERAL'
    CHARACTER_FOCUSED = 'CHARACTER_FOCUSED'
    CONFLICT_FOCUSED = 'CONFLICT_FOCUSED'


class ResponseStyle(str, Enum):
    FRIEND = 'FRIEND'
    ASSISTANT = 'ASSISTANT'
    CRITIC = 'CRITIC'


class RelationType(str, Enum):
    FAMILY = 'FAMILY'
    ROMANCE = 'ROMANCE'
    ALLY = 'ALLY'
    MISTRUST = 'MISTRUST'
    BOSS_SUBORDINATE = 'BOSS_SUBORDINATE'
    FRIEND = 'FRIEND'
    RIVAL = 'RIVAL'
    UNKNOWN = 'UNKNOWN'


class RecapRequest(BaseModel):
    title_id: str
    episode_id: str
    current_time_ms: int
    preset: RecapPreset
    mode: RecapMode | None = None
    language: str | None = 'ko'
    response_style: ResponseStyle | None = ResponseStyle.FRIEND

    @field_validator('current_time_ms')
    @classmethod
    def validate_time(cls, value: int) -> int:
        if value < 0:
            raise ValueError('current_time_ms must be >= 0')
        return value


class MetaEnvelope(BaseModel):
    title_id: str
    episode_id: str
    current_time_ms: int
    spoiler_guard_applied: bool
    model: str | None = None


class RecapPayload(BaseModel):
    text: str
    bullets: list[str]


class RecapResponse(BaseModel):
    meta: MetaEnvelope
    recap: RecapPayload
    watch_points: list[str]
    evidences: list[Evidence]
    warnings: list[WarningItem]


class QARequestFocus(BaseModel):
    character_ids: list[str] | None = None
    relation_id: str | None = None


class QARequest(BaseModel):
    title_id: str
    episode_id: str
    current_time_ms: int
    question: str = Field(min_length=1)
    focus: QARequestFocus | None = None
    language: str | None = 'ko'
    response_style: ResponseStyle | None = ResponseStyle.FRIEND

    @field_validator('current_time_ms')
    @classmethod
    def validate_time(cls, value: int) -> int:
        if value < 0:
            raise ValueError('current_time_ms must be >= 0')
        return value


class Interpretation(BaseModel):
    label: str
    text: str
    confidence: float = Field(ge=0.0, le=1.0)


class AnswerPayload(BaseModel):
    conclusion: str
    context: list[str]
    interpretations: list[Interpretation]
    overall_confidence: float = Field(ge=0.0, le=1.0)


class GraphHighlight(BaseModel):
    type: str
    ids: list[str]


class RelatedGraphFocus(BaseModel):
    relation_id: str | None = None
    highlight: GraphHighlight | None = None


class QAResponse(BaseModel):
    meta: MetaEnvelope
    answer: AnswerPayload
    evidences: list[Evidence]
    related_graph_focus: RelatedGraphFocus | None = None
    warnings: list[WarningItem]


class GraphNode(BaseModel):
    id: str
    label: str
    description: str | None = None
    aliases: list[str] = Field(default_factory=list)


class GraphEdge(BaseModel):
    id: str
    from_character_id: str
    to_character_id: str
    relation_type: RelationType
    is_hypothesis: bool
    confidence: float = Field(ge=0.0, le=1.0)
    valid_from_time_ms: int
    valid_to_time_ms: int | None = None
    evidences: list[Evidence]


class GraphMeta(BaseModel):
    title_id: str
    episode_id: str
    current_time_ms: int
    spoiler_guard_applied: bool


class GraphResponse(BaseModel):
    meta: GraphMeta
    nodes: list[GraphNode]
    edges: list[GraphEdge]
    warnings: list[WarningItem]


class RelationDetailResponse(BaseModel):
    relation: GraphEdge
    warnings: list[WarningItem]


class CharacterOut(BaseModel):
    id: str
    title_id: str
    canonical_name: str
    description: str | None = None
    aliases: list[str]


class CharacterSummary(BaseModel):
    text: str
    key_events: list[str]


class CharacterCardMeta(BaseModel):
    character_id: str
    episode_id: str
    current_time_ms: int
    spoiler_guard_applied: bool


class CharacterCardResponse(BaseModel):
    meta: CharacterCardMeta
    character: CharacterOut
    summary: CharacterSummary
    evidences: list[Evidence]
    warnings: list[WarningItem]


class ResolveEntityRequest(BaseModel):
    title_id: str
    episode_id: str
    current_time_ms: int
    mention_text: str = Field(min_length=1)
    context_subtitle_line_id: str | None = None


class ResolveCandidate(BaseModel):
    character_id: str
    canonical_name: str
    reason: str
    confidence: float = Field(ge=0.0, le=1.0)


class ResolveEntityMeta(BaseModel):
    title_id: str
    episode_id: str
    current_time_ms: int
    spoiler_guard_applied: bool


class ResolveEntityResponse(BaseModel):
    meta: ResolveEntityMeta
    mention_text: str
    candidates: list[ResolveCandidate]
    warnings: list[WarningItem]


class AuthUser(BaseModel):
    id: str
    name: str
    email: str
    created_at: str | None = None


class SignupRequest(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    email: str = Field(min_length=5, max_length=255)
    password: str = Field(min_length=8, max_length=128)

    @field_validator('email')
    @classmethod
    def validate_email(cls, value: str) -> str:
        normalized = value.strip().lower()
        if '@' not in normalized or normalized.startswith('@') or normalized.endswith('@'):
            raise ValueError('Invalid email format')
        return normalized


class LoginRequest(BaseModel):
    email: str = Field(min_length=5, max_length=255)
    password: str = Field(min_length=1, max_length=128)

    @field_validator('email')
    @classmethod
    def normalize_email(cls, value: str) -> str:
        return value.strip().lower()


class AuthResponse(BaseModel):
    access_token: str
    token_type: str = 'bearer'
    user: AuthUser


class TitleCreateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    description: str | None = None


class EpisodeCreateRequest(BaseModel):
    title_id: str
    season: int = Field(ge=1)
    episode_number: int = Field(ge=1)
    name: str | None = None
    duration_ms: int = Field(ge=1)


class SubtitleLineCreate(BaseModel):
    episode_id: str
    start_ms: int = Field(ge=0)
    end_ms: int = Field(ge=0)
    text: str = Field(min_length=1)
    speaker_text: str | None = None
    speaker_character_id: str | None = None

    @field_validator('end_ms')
    @classmethod
    def validate_time_range(cls, value: int, info) -> int:
        start_ms = info.data.get('start_ms')
        if start_ms is not None and value < int(start_ms):
            raise ValueError('end_ms must be >= start_ms')
        return value


class SubtitleLineBulkRequest(BaseModel):
    lines: list[SubtitleLineCreate] = Field(min_length=1)


class IngestSubtitleLinesResponse(BaseModel):
    inserted_count: int
    queued_embedding_jobs: int


class ChatRole(str, Enum):
    USER = 'user'
    ASSISTANT = 'assistant'
    SYSTEM = 'system'


class ChatSessionCreateRequest(BaseModel):
    title_id: str
    episode_id: str
    user_id: str
    current_time_ms: int = Field(ge=0)
    meta: dict = Field(default_factory=dict)


class ChatSessionOut(BaseModel):
    id: str
    title_id: str
    episode_id: str
    user_id: str
    current_time_ms: int
    meta: dict
    created_at: str | None = None


class ChatSessionListResponse(BaseModel):
    items: list[ChatSessionOut]


class ChatMessageCreateRequest(BaseModel):
    role: ChatRole
    content: str = Field(min_length=1)
    current_time_ms: int = Field(ge=0)
    model: str | None = None
    prompt_tokens: int | None = Field(default=None, ge=0)
    completion_tokens: int | None = Field(default=None, ge=0)
    related_relation_id: str | None = None


class ChatMessageOut(BaseModel):
    id: str
    session_id: str
    role: ChatRole
    content: str
    current_time_ms: int
    model: str | None = None
    prompt_tokens: int | None = None
    completion_tokens: int | None = None
    related_relation_id: str | None = None
    created_at: str | None = None


class ChatMessageListResponse(BaseModel):
    session_id: str
    items: list[ChatMessageOut]
