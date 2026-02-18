from pathlib import Path

PROMPT_DIR = Path(__file__).resolve().parent.parent / 'prompts'


def load_prompt(file_name: str) -> str:
    return (PROMPT_DIR / file_name).read_text(encoding='utf-8')
