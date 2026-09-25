from . import config

_clients = {}


def get_client(provider: str):
    if provider in _clients:
        return _clients[provider]
    if provider == "claude":
        from anthropic import AsyncAnthropic

        if not config.ANTHROPIC_API_KEY:
            raise RuntimeError("ANTHROPIC_API_KEY is not set. Add it to your .env file.")
        _clients[provider] = AsyncAnthropic(api_key=config.ANTHROPIC_API_KEY)
    elif provider == "groq":
        from openai import AsyncOpenAI

        if not config.GROQ_API_KEY:
            raise RuntimeError("GROQ_API_KEY is not set. Add it to your .env file.")
        _clients[provider] = AsyncOpenAI(api_key=config.GROQ_API_KEY, base_url=config.GROQ_BASE_URL)
    else:
        raise RuntimeError(f"Unknown LLM_PROVIDER: {provider}")
    return _clients[provider]


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
    provider = config.LLM_PROVIDER
    client = get_client(provider)
    system_prompt = build_system_prompt(level, language)

    messages = [
        {"role": "assistant" if t.get("role") == "assistant" else "user", "content": t.get("content", "")}
        for t in history
        if t.get("content")
    ]
    messages.append({"role": "user", "content": message})

    if provider == "claude":
        async with client.messages.stream(
            model=config.CLAUDE_MODEL,
            max_tokens=config.MAX_TOKENS_PER_RESPONSE,
            system=system_prompt,
            messages=messages,
        ) as stream:
            async for text in stream.text_stream:
                yield text
    else:
        stream = await client.chat.completions.create(
            model=config.GROQ_MODEL,
            max_tokens=config.MAX_TOKENS_PER_RESPONSE,
            messages=[{"role": "system", "content": system_prompt}] + messages,
            stream=True,
        )
        async for chunk in stream:
            if chunk.choices and chunk.choices[0].delta.content:
                yield chunk.choices[0].delta.content
