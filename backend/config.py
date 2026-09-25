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

# "groq" (free: Whisper STT, browser TTS) or "elevenlabs" (needs a working paid account)
VOICE_PROVIDER = os.getenv("VOICE_PROVIDER", "groq").lower()
GROQ_STT_MODEL = os.getenv("GROQ_STT_MODEL", "whisper-large-v3-turbo")

ELEVENLABS_API_KEY =os.getenv("ELEVENLABS_API_KEY", "")
ELEVENLABS_VOICE_ID = os.getenv("ELEVENLABS_VOICE_ID", "")
# Default ElevenLabs premade voices: Sarah (female) and George (male)
ELEVENLABS_VOICE_ID_FEMALE = os.getenv("ELEVENLABS_VOICE_ID_FEMALE", ELEVENLABS_VOICE_ID or "EXAVITQu4vr4xnSDxMaL")
ELEVENLABS_VOICE_ID_MALE = os.getenv("ELEVENLABS_VOICE_ID_MALE", "JBFqnCBsd6RMkjVDRZzb")
ELEVENLABS_AGENT_ID = os.getenv("ELEVENLABS_AGENT_ID", "")

# Pilot cost/usage controls
MAX_MESSAGES_PER_USER_PER_DAY = int(os.getenv("MAX_MESSAGES_PER_USER_PER_DAY", "50"))
MAX_TOKENS_PER_RESPONSE = int(os.getenv("MAX_TOKENS_PER_RESPONSE", "800"))

SUPPORTED_LANGUAGES = ["en", "ur", "ar", "fa"]
RTL_LANGUAGES = {"ur", "ar", "fa"}
ACADEMIC_LEVELS = ["foundation", "undergraduate", "postgraduate"]
