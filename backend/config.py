import os
from dotenv import load_dotenv

load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-3.8")

ELEVENLABS_API_KEY = os.getenv("ELEVENLABS_API_KEY", "")
ELEVENLABS_VOICE_ID = os.getenv("ELEVENLABS_VOICE_ID", "")
ELEVENLABS_AGENT_ID = os.getenv("ELEVENLABS_AGENT_ID", "")

# Pilot cost/usage controls
MAX_MESSAGES_PER_USER_PER_DAY = int(os.getenv("MAX_MESSAGES_PER_USER_PER_DAY", "50"))
MAX_TOKENS_PER_RESPONSE = int(os.getenv("MAX_TOKENS_PER_RESPONSE", "1024"))

SUPPORTED_LANGUAGES = ["en", "ur", "ar", "fa"]
RTL_LANGUAGES = {"ur", "ar", "fa"}
ACADEMIC_LEVELS = ["foundation", "undergraduate", "postgraduate"]
