import asyncio
import time

import httpx

from . import config

BASE = "https://api.elevenlabs.io/v1"


def _headers():
    if not config.ELEVENLABS_API_KEY:
        raise RuntimeError("ELEVENLABS_API_KEY is not set. Add it to your .env file.")
    return {"xi-api-key": config.ELEVENLABS_API_KEY}


EDGE_VOICES = {
    "en": {"female": "en-US-AvaNeural", "male": "en-US-AndrewNeural"},
    "ur": {"female": "ur-PK-UzmaNeural", "male": "ur-PK-AsadNeural"},
    "ar": {"female": "ar-SA-ZariyahNeural", "male": "ar-SA-HamedNeural"},
    "fa": {"female": "fa-IR-DilaraNeural", "male": "fa-IR-FaridNeural"},
}


async def _edge_tts(text: str, gender: str, language: str) -> bytes:
    import edge_tts

    voice = EDGE_VOICES.get(language, EDGE_VOICES["en"]).get(gender, EDGE_VOICES["en"]["female"])
    audio = b""
    async for chunk in edge_tts.Communicate(text, voice).stream():
        if chunk["type"] == "audio":
            audio += chunk["data"]
    if not audio:
        raise RuntimeError("no audio returned")
    return audio


_tts_cache: dict = {}
_TTS_CACHE_MAX = 300


async def text_to_speech(text: str, gender: str = "female", language: str = "en") -> bytes:
    key = (config.TTS_PROVIDER, text, gender, language)
    if key in _tts_cache:
        return _tts_cache[key]
    audio, from_primary = await _synthesize(text, gender, language)
    if from_primary:  # don't cache fallback audio, so ElevenLabs takes over as soon as it works
        if len(_tts_cache) >= _TTS_CACHE_MAX:
            _tts_cache.pop(next(iter(_tts_cache)))
        _tts_cache[key] = audio
    return audio


async def warm_up():
    """Open a first connection for every voice so the first real reply isn't slow."""
    if config.TTS_PROVIDER == "elevenlabs":
        try:
            await _synthesize("Hello.", "female", "en")  # detects an unusable account before the first real request
        except Exception:
            pass
    for language in EDGE_VOICES:
        for gender in ("female", "male"):
            try:
                await _edge_tts(".", gender, language)
            except Exception:
                pass


async def _edge_with_retry(text: str, gender: str, language: str) -> bytes:
    # The free service sometimes stalls; a quick retry is usually much faster than waiting.
    for attempt in range(3):
        try:
            return await asyncio.wait_for(_edge_tts(text, gender, language), timeout=4 if attempt < 2 else 15)
        except Exception:
            if attempt == 2:
                raise


async def _elevenlabs_tts(text: str, gender: str) -> bytes:
    voice_id = config.ELEVENLABS_VOICE_ID_MALE if gender == "male" else config.ELEVENLABS_VOICE_ID_FEMALE
    async with httpx.AsyncClient(timeout=30) as client:
        res = await client.post(
            f"{BASE}/text-to-speech/{voice_id}",
            headers=_headers(),
            json={"text": text, "model_id": "eleven_multilingual_v2"},
        )
        res.raise_for_status()
        return res.content


_eleven_blocked_until = 0.0


async def _synthesize(text: str, gender: str, language: str) -> tuple[bytes, bool]:
    """Returns (audio, produced_by_configured_provider)."""
    global _eleven_blocked_until
    if config.TTS_PROVIDER == "elevenlabs":
        if time.time() >= _eleven_blocked_until:
            try:
                return await _elevenlabs_tts(text, gender), True
            except Exception:
                # Account/quota problem: skip ElevenLabs for 10 minutes and use the free voices
                _eleven_blocked_until = time.time() + 600
        return await _edge_with_retry(text, gender, language), False
    return await _edge_with_retry(text, gender, language), True


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
