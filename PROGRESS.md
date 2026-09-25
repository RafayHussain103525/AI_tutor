# LUMA (Learning & University Mentor Assistant) — Progress Tracker

Tracks the 14-day compressed plan against what's actually done. Updated after every work session.

## Plan vs. Status

| Day | Activity | Status | Notes |
|---|---|---|---|
| 1 | Env setup, API credentials, config, repo | Done | Repo, `.env.example`, config module, Python 3.12 + `.venv` installed |
| 2–4 | AI Tutor integration (Claude), prompt config, streaming, level/language selection, math/code formatting | Working (free demo via Groq) | Provider switch `LLM_PROVIDER=groq|claude`. Groq `openai/gpt-oss-120b` tested OK in English, Arabic, Persian, Urdu. Claude path built (Haiku 4.5 only, 600-token cap) but Anthropic account has no credits yet — flip `LLM_PROVIDER=claude` after buying credits |
| 5–6 | STT/TTS integration (ElevenLabs Scribe + TTS) | Working (free path) | `VOICE_PROVIDER=groq`: mic -> Groq Whisper STT (verified in English via API); read-aloud uses browser speech synthesis (needs an installed OS voice for ur/ar/fa; not browser-tested). ElevenLabs path (`VOICE_PROVIDER=elevenlabs`) is built but the account returns `401 detected_unusual_activity` (needs paid plan) |
| 7 | Multilingual + RTL validation (Urdu, Arabic, Persian) | Not started | RTL CSS/JS toggle scaffolded; needs real testing once chat works |
| 8–9 | Live AI voice agent (ElevenLabs Agent) | Not started | Needs `ELEVENLABS_AGENT_ID` |
| 10 | Institutional branding + UI/UX pass | Not started | |
| 11 | Deployment, security, usage/cost controls | Partially started | In-memory per-user daily cap (`backend/usage.py`). Deployment = local, run from this folder, for now |
| 12 | Internal QA + academic validation | Not started | |
| 13 | Controlled student pilot + fixes | Not started | |
| 14 | Final UAT + Go-Live | Not started | |

## Accounts & history (added 2026-09-25)

- Google sign-in restricted to `@tuf.edu.pk` (server verifies the Google token, `email_verified`, and `hd`). Signed httponly session cookie, 30 days.
- Chat history per user in SQLite (`data/luma.db`): list, open, rename, delete; grouped by date in the sidebar. Server loads the last 20 messages as model context.
- Daily message cap and voice endpoints now use the signed-in account (previously a client-supplied ID).
- **Not yet live**: needs `GOOGLE_CLIENT_ID` in `.env` (see README). Until then `DEV_LOGIN=1` allows domain-checked local sign-in without Google. Real Google sign-in is untested.

## What exists right now

- `backend/main.py` — FastAPI app: `/api/chat` (streaming), `/api/config`, `/api/tts`, `/api/stt`
- `backend/llm.py` — Claude integration, level/language-aware prompts, streaming
- `backend/voice.py` — ElevenLabs TTS (`eleven_multilingual_v2`) and STT (`scribe_v1`)
- `backend/usage.py` — per-user daily message cap (in-memory)
- `backend/config.py` — env-driven settings
- `frontend/` — chat UI, level/language selectors, Markdown + KaTeX, RTL switch, mic button, read-aloud toggle
- Run: `.venv\Scripts\python.exe -m uvicorn backend.main:app --port 8000` then open http://localhost:8000

## Known blockers

- **Anthropic account has no credits** (`400 credit balance too low`). Key is saved in `.env`; Claude is unused until credits are bought. Groq free tier covers the demo meanwhile.
- **ElevenLabs account blocked**: Free Tier disabled for "unusual activity", so TTS/STT are unverified until there is a paid plan or a new key. The key also lacks the `user_read` permission. `ELEVENLABS_AGENT_ID` is not set (Days 8–9).

## Decisions made

- LLM provider: Anthropic -> Gemini (2026-09-24) -> back to Claude (2026-09-25), because the Gemini keys were denied (school Workspace account).
- **Model restriction for the pilot**: users cannot choose the model. It is fixed server-side to Claude Haiku 4.5 (cheapest) with a 600-token reply cap. Latest/high-tier models are blocked via `ALLOWED_CLAUDE_MODELS` in `backend/config.py`; widen only deliberately.
- Compressed the 25-day proposal to 14 days by merging phases and running QA continuously.
- Usage/cost control is an in-memory counter for now; needs a real store before a shared deployment.
- Deployment stays local (same folder) for now, per user instruction.

---
*Last updated: 2026-09-25 (later)*
