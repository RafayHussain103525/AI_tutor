import os
from dotenv import load_dotenv

load_dotenv()

# ---------- Accounts & storage ----------
# Google OAuth client ID (Google Cloud Console -> APIs & Services -> Credentials -> OAuth client ID, "Web application")
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "").strip()
# Only accounts on this Google Workspace domain may sign in
ALLOWED_EMAIL_DOMAIN = os.getenv("ALLOWED_EMAIL_DOMAIN", "tuf.edu.pk").strip().lower()
# Local testing only: lets you sign in by typing a domain email, WITHOUT Google. Never enable on a real server.
DEV_LOGIN = os.getenv("DEV_LOGIN", "0") == "1"
SESSION_DAYS = int(os.getenv("SESSION_DAYS", "30"))
DB_PATH = os.getenv("DB_PATH", os.path.join("data", "luma.db"))


def _load_secret() -> str:
    """Session-signing key: from SECRET_KEY, or generated once and kept in data/secret.key."""
    key = os.getenv("SECRET_KEY", "").strip()
    if key:
        return key
    path = os.path.join(os.path.dirname(DB_PATH) or ".", "secret.key")
    if os.path.exists(path):
        return open(path, encoding="utf-8").read().strip()
    import secrets

    os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
    key = secrets.token_hex(32)
    with open(path, "w", encoding="utf-8") as f:
        f.write(key)
    return key


SECRET_KEY = _load_secret()

# "groq" (free tier, for demo) or "claude" (once credits are bought) or GEMINI FREE API KEYS
LLM_PROVIDER = os.getenv("LLM_PROVIDER", "gemini").lower()
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY","")
GEMINI_MODEL = os.getenv("GEMINI_MODEL","gemini-3.5-flash-lite")
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
GROQ_STT_MODEL = os.getenv("GROQ_STT_MODEL", "whisper-large-v3")  # full model: noticeably better for Urdu/Arabic/Persian than -turbo

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
MAX_TOKENS_PER_RESPONSE = int(os.getenv("MAX_TOKENS_PER_RESPONSE", "2500"))  # Claude (paid, generous limits)

# Groq's free "on_demand" tier caps this model at 8000 tokens PER REQUEST (prompt + history +
# reserved output all count). A lower output cap here, plus trimming old history in llm.py,
# keeps requests under that ceiling regardless of how long a conversation gets.
GROQ_MAX_TOKENS_PER_RESPONSE = int(os.getenv("GROQ_MAX_TOKENS_PER_RESPONSE", "1200"))
GROQ_TPM_LIMIT = int(os.getenv("GROQ_TPM_LIMIT", "8000"))

SUPPORTED_LANGUAGES = ["en", "ur", "ar", "fa"]
RTL_LANGUAGES = {"ur", "ar", "fa"}
ACADEMIC_LEVELS = ["foundation", "undergraduate", "postgraduate"]
