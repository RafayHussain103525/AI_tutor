import httpx

from . import config

BASE = "https://api.elevenlabs.io/v1"


def _headers():
    if not config.ELEVENLABS_API_KEY:
        raise RuntimeError("ELEVENLABS_API_KEY is not set. Add it to your .env file.")
    return {"xi-api-key": config.ELEVENLABS_API_KEY}


async def text_to_speech(text: str) -> bytes:
    async with httpx.AsyncClient(timeout=60) as client:
        res = await client.post(
            f"{BASE}/text-to-speech/{config.ELEVENLABS_VOICE_ID}",
            headers=_headers(),
            json={"text": text, "model_id": "eleven_multilingual_v2"},
        )
        res.raise_for_status()
        return res.content


async def speech_to_text(audio: bytes, filename: str, content_type: str, language: str | None) -> str:
    if config.VOICE_PROVIDER == "groq":
        if not config.GROQ_API_KEY:
            raise RuntimeError("GROQ_API_KEY is not set. Add it to your .env file.")
        data = {"model": config.GROQ_STT_MODEL}
        if language:
            data["language"] = language
        async with httpx.AsyncClient(timeout=120) as client:
            res = await client.post(
                f"{config.GROQ_BASE_URL}/audio/transcriptions",
                headers={"Authorization": f"Bearer {config.GROQ_API_KEY}"},
                data=data,
                files={"file": (filename, audio, content_type)},
            )
            res.raise_for_status()
            return res.json().get("text", "")

    data = {"model_id": "scribe_v1"}
    if language:
        data["language_code"] = language
    async with httpx.AsyncClient(timeout=120) as client:
        res = await client.post(
            f"{BASE}/speech-to-text",
            headers=_headers(),
            data=data,
            files={"file": (filename, audio, content_type)},
        )
        res.raise_for_status()
        return res.json().get("text", "")
