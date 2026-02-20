from __future__ import annotations

import re
from dataclasses import dataclass

WORD_RE = re.compile(r"[a-zA-Z0-9\uAC00-\uD7A3]+")
SPACE_RE = re.compile(r"\s+")

CASUAL_KEYWORDS = {
    "\uc548\ub155",
    "\ud558\uc774",
    "hello",
    "hi",
    "\ubc18\uac00\uc6cc",
    "\uace0\ub9c8\uc6cc",
    "thanks",
    "thankyou",
    "\ub0a0\uc528",
    "\uba87\uc2dc",
    "\uc2dc\uac04",
    "\ub18d\ub2f4",
    "joke",
    "\uc774\ub984",
    "\ub108\ub204\uad6c",
    "\ubb50\ud574",
    "\uc2ec\uc2ec\ud574",
    "\uc2ec\uc2ec",
    "\uace0\ubbfc",
    "\uadf8\ub0e5",
    "\ucd94\ucc9c",
    "\ub3c4\uc640\uc918",
    "\uc870\uc5b8",
    "\uace0\ubbfc\uc0c1\ub2f4",
    "recommend",
    "help",
    "advice",
}

CASUAL_PREFIXES = (
    "\uc548\ub155",
    "\ud558\uc774",
    "hello",
    "hi",
    "\ub108 \ub204\uad6c",
    "\uba87 \uc2dc",
    "\ub098 \uc624\ub298",
    "\ub098 \uc694\uc998",
    "\uc694\uc998",
)

EPISODE_KEYWORDS = {
    "\uc5d0\ud53c\uc18c\ub4dc",
    "\uc791\ud488",
    "\uc7a5\uba74",
    "\ub300\uc0ac",
    "\uc790\ub9c9",
    "\uc601\uc0c1",
    "\ud0c0\uc784\ub77c\uc778",
    "\uad00\uacc4",
    "\uc778\ubb3c",
    "\uac08\ub4f1",
    "\uadfc\uac70",
    "\uc694\uc57d",
    "\uc2a4\ud1a0\ub9ac",
    "\ub0b4\uc6a9",
    "episode",
    "scene",
    "subtitle",
    "character",
    "plot",
    "story",
    "timeline",
}

CASUAL_PATTERNS = (
    re.compile(r"\bwhat should i eat\b"),
    re.compile(r"\bwhat to eat\b"),
    re.compile(r"(\uc624\ub298|\uc800\ub141|\uc810\uc2ec|\uc544\uce68).*(\uba39\uc744\uae4c|\uba39\uc9c0|\uba54\ub274)"),
    re.compile(r"\ubb50\s*\uba39"),
    re.compile(r"(\ucd94\ucc9c\ud574\uc918|\ucd94\ucc9c\ud574\uc8fc\uc138\uc694)"),
    re.compile(r"(\ubc30\uace0\ud30c|\ud5db\uac00\ub798)"),
    re.compile(r"(\ubb50\ud574|\ubb50\ud558\ub0d0|\ubb50\ud560\uae4c)"),
    re.compile(r"(\ub3c4\uc640\uc918|\uc870\uc5b8\ud574\uc918|\uc0c1\ub2f4\ud574\uc918)"),
    re.compile(r"(recommend|advice|help me)", re.IGNORECASE),
)


@dataclass(frozen=True)
class QueryIntentResult:
    intent: str
    confidence: float
    normalized_question: str
    reason: str


def _normalize(text: str) -> str:
    lowered = text.strip().lower()
    lowered = lowered.replace("?", " ").replace("!", " ").replace(".", " ")
    return SPACE_RE.sub(" ", lowered).strip()


def _compact_korean(text: str) -> str:
    return text.replace(" ", "")


def _tokenize(text: str) -> list[str]:
    return [token for token in WORD_RE.findall(text.lower()) if token]


def classify_query_intent(question: str) -> QueryIntentResult:
    normalized = _normalize(question)
    compact = _compact_korean(normalized)
    tokens = _tokenize(normalized)
    token_set = set(tokens)

    if not normalized:
        return QueryIntentResult(
            intent="CASUAL",
            confidence=0.9,
            normalized_question="",
            reason="empty_question",
        )

    episode_score = 0.2
    casual_score = 0.0
    reasons: list[str] = []

    if any(normalized.startswith(prefix) for prefix in CASUAL_PREFIXES):
        casual_score += 0.55
        reasons.append("casual_prefix")

    if any(pattern.search(normalized) for pattern in CASUAL_PATTERNS):
        casual_score += 0.7
        reasons.append("casual_pattern")

    casual_hits = sum(1 for keyword in CASUAL_KEYWORDS if keyword in compact or keyword in token_set)
    if casual_hits:
        casual_score += min(0.5, casual_hits * 0.18)
        reasons.append(f"casual_keywords={casual_hits}")

    episode_hits = sum(1 for keyword in EPISODE_KEYWORDS if keyword in normalized or keyword in compact)
    if episode_hits:
        episode_score += min(0.6, episode_hits * 0.16)
        reasons.append(f"episode_keywords={episode_hits}")

    if any(token.isdigit() for token in tokens) and ("\ubd84" in normalized or ":" in question):
        episode_score += 0.15
        reasons.append("timeline_expression")

    if len(tokens) <= 2 and casual_score >= 0.5:
        casual_score += 0.15
        reasons.append("short_casual_utterance")

    if episode_hits == 0 and len(tokens) <= 12 and ("?" in question or normalized.endswith("\uae4c")):
        casual_score += 0.18
        reasons.append("short_question_without_episode_signals")

    if episode_hits == 0 and casual_hits >= 1:
        return QueryIntentResult(
            intent="CASUAL",
            confidence=min(0.98, max(casual_score, 0.76)),
            normalized_question=normalized,
            reason=",".join(reasons) or "casual_keyword_without_episode_signals",
        )

    if episode_hits == 0 and casual_score >= 0.6:
        return QueryIntentResult(
            intent="CASUAL",
            confidence=min(0.98, max(casual_score, 0.8)),
            normalized_question=normalized,
            reason=",".join(reasons) or "casual_without_episode_signals",
        )

    if casual_score >= 0.75 and casual_score > episode_score + 0.15:
        return QueryIntentResult(
            intent="CASUAL",
            confidence=min(0.98, casual_score),
            normalized_question=normalized,
            reason=",".join(reasons) or "casual_rule",
        )

    return QueryIntentResult(
        intent="EPISODE",
        confidence=min(0.98, episode_score),
        normalized_question=normalized,
        reason=",".join(reasons) or "episode_default_bias",
    )
