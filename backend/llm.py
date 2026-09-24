from google import genai
from google.genai import types

from . import config

_client = None


def get_client():
    global _client
    if _client is None:
        if not config.GEMINI_API_KEY:
            raise RuntimeError("GEMINI_API_KEY is not set. Add it to your .env file.")
        _client = genai.Client(api_key=config.GEMINI_API_KEY)
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

    contents = []
    for turn in history:
        role = "model" if turn.get("role") == "assistant" else "user"
        contents.append(types.Content(role=role, parts=[types.Part(text=turn.get("content", ""))]))
    contents.append(types.Content(role="user", parts=[types.Part(text=message)]))

    stream = await client.aio.models.generate_content_stream(
        model=config.GEMINI_MODEL,
        contents=contents,
        config=types.GenerateContentConfig(
            system_instruction=system_prompt,
            max_output_tokens=config.MAX_TOKENS_PER_RESPONSE,
        ),
    )

    async for chunk in stream:
        if chunk.text:
            yield chunk.text
