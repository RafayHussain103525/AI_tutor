from anthropic import AsyncAnthropic

from . import config

_client = None


def get_client():
    global _client
    if _client is None:
        if not config.ANTHROPIC_API_KEY:
            raise RuntimeError("ANTHROPIC_API_KEY is not set. Add it to your .env file.")
        _client = AsyncAnthropic(api_key=config.ANTHROPIC_API_KEY)
    return _client


LEVEL_INSTRUCTIONS = {
    "foundation": "Explain in simple terms suitable for a foundation-year student. Avoid jargon, use everyday analogies, and break steps down clearly.",
    "undergraduate": "Explain at an undergraduate level. You may use standard technical terminology, but define non-obvious terms.",
    "postgraduate": "Explain at a postgraduate/research level. Assume strong domain background and be precise and rigorous.",
}

LANGUAGE_NAMES = {
    "en": "English",
    "ur": "Urdu",
    "ar": "Arabic",
    "fa": "Persian",
}


def build_system_prompt(level: str, language: str) -> str:
    level_instruction = LEVEL_INSTRUCTIONS.get(level, LEVEL_INSTRUCTIONS["undergraduate"])
    language_name = LANGUAGE_NAMES.get(language, "English")

    return (
        "You are an AI academic tutor helping a student. "
        f"{level_instruction} "
        f"Respond in {language_name}, unless the student writes in a different language, "
        "in which case follow their language. "
        "Format mathematics using LaTeX ($...$ for inline, $$...$$ for block). "
        "Format programming code using fenced Markdown code blocks with a language tag. "
        "Keep answers focused and academically accurate."
    )


async def stream_tutor_reply(message: str, level: str, language: str, history: list[dict]):
    client = get_client()
    system_prompt = build_system_prompt(level, language)

    messages = [
        {"role": "assistant" if t.get("role") == "assistant" else "user", "content": t.get("content", "")}
        for t in history
        if t.get("content")
    ]
    messages.append({"role": "user", "content": message})

    async with client.messages.stream(
        model=config.CLAUDE_MODEL,
        max_tokens=config.MAX_TOKENS_PER_RESPONSE,
        system=system_prompt,
        messages=messages,
    ) as stream:
        async for text in stream.text_stream:
            yield text
