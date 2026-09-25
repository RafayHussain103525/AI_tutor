import os
from dotenv import load_dotenv

load_dotenv()

ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")

# Pilot restriction: only cheap models may be used. The model is fixed server-side
# (users cannot choose it). Anything not on the allowlist falls back to Haiku.
ALLOWED_CLAUDE_MODELS = {"claude-haiku-4-5-20251001"}
DEFAULT_CLAUDE_MODEL = "claude-haiku-4-5-20251001"
CLAUDE_MODEL = os.getenv("CLAUDE_MODEL", DEFAULT_CLAUDE_MODEL)
if CLAUDE_MODEL not in ALLOWED_CLAUDE_MODELS:
    CLAUDE_MODEL = DEFAULT_CLAUDE_MODEL

ELEVENLABS_API_KEY = os.getenv("ELEVENLABS_API_KEY", "")
ELEVENLABS_VOICE_ID = os.getenv("ELEVENLABS_VOICE_ID", "")
ELEVENLABS_AGENT_ID = os.getenv("ELEVENLABS_AGENT_ID", "")

# Pilot cost/usage controls
MAX_MESSAGES_PER_USER_PER_DAY = int(os.getenv("MAX_MESSAGES_PER_USER_PER_DAY", "50"))
MAX_TOKENS_PER_RESPONSE = int(os.getenv("MAX_TOKENS_PER_RESPONSE", "600"))

SUPPORTED_LANGUAGES = ["en", "ur", "ar", "fa"]
RTL_LANGUAGES = {"ur", "ar", "fa"}
ACADEMIC_LEVELS = ["foundation", "undergraduate", "postgraduate"]
