import os
from dotenv import load_dotenv

load_dotenv()

# "groq" (free tier, for demo) or "claude" (once credits are bought)
LLM_PROVIDER = os.getenv("LLM_PROVIDER", "groq").lower()

GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
GROQ_MODEL = os.getenv("GROQ_MODEL", "openai/gpt-oss-120b")
GROQ_BASE_URL = "https://api.groq.com/openai/v1"

ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")

# Pilot restriction: only cheap models may be used. The model is fixed server-side
# (users cannot choose it). Anything not on the allowlist falls back to Haiku.
ALLOWED_CLAUDE_MODELS = {"claude-haiku-4-5-20251001"}
DEFAULT_CLAUDE_MODEL = "claude-haiku-4-5-20251001"
CLAUDE_MODEL = os.getenv("CLAUDE_MODEL", DEFAULT_CLAUDE_MODEL)
if CLAUDE_MODEL not in ALLOWED_CLAUDE_MODELS:
    CLAUDE_MODEL = DEFAULT_CLAUDE_MODEL

# "groq" (free: Whisper speech-to-text) or "elevenlabs" (needs a working paid account)
VOICE_PROVIDER = os.getenv("VOICE_PROVIDER", "groq").lower()
GROQ_STT_MODEL = os.getenv("GROQ_STT_MODEL", "whisper-large-v3-turbo")

# Text-to-speech, always generated server-side: "edge" (free neural voices) or "elevenlabs"
# (Allison/George; automatically falls back to the free voices if the ElevenLabs account errors)
TTS_PROVIDER = os.getenv("TTS_PROVIDER", "edge").lower()

ELEVENLABS_API_KEY =os.getenv("ELEVENLABS_API_KEY", "")
ELEVENLABS_VOICE_ID = os.getenv("ELEVENLABS_VOICE_ID", "")
# Female: "Allison - Energetic, Clear and Bubbly"; male: George (premade)
ELEVENLABS_VOICE_ID_FEMALE = os.getenv("ELEVENLABS_VOICE_ID_FEMALE", "xctasy8XvGp2cVO9HL9k")
ELEVENLABS_VOICE_ID_MALE = os.getenv("ELEVENLABS_VOICE_ID_MALE", "JBFqnCBsd6RMkjVDRZzb")
ELEVENLABS_AGENT_ID = os.getenv("ELEVENLABS_AGENT_ID", "")

# Pilot cost/usage controls
MAX_MESSAGES_PER_USER_PER_DAY = int(os.getenv("MAX_MESSAGES_PER_USER_PER_DAY", "50"))
MAX_TOKENS_PER_RESPONSE = int(os.getenv("MAX_TOKENS_PER_RESPONSE", "2500"))

SUPPORTED_LANGUAGES = ["en", "ur", "ar", "fa"]
RTL_LANGUAGES = {"ur", "ar", "fa"}
ACADEMIC_LEVELS = ["foundation", "undergraduate", "postgraduate"]
