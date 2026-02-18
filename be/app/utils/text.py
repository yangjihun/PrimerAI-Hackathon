from __future__ import annotations


def summarize_lines(lines: list[str], max_chars: int = 220) -> str:
    if not lines:
        return ''
    merged = ' '.join(line.strip() for line in lines if line.strip())
    return merged[:max_chars]
