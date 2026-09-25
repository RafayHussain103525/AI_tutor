# AI Tutor — Progress Tracker

Tracks the 14-day compressed plan against what's actually done. Updated after every work session.

## Plan vs. Status

| Day | Activity | Status | Notes |
|---|---|---|---|
| 1 | Env setup, API credentials, config, repo | Done | Repo, `.env.example`, config module, Python 3.12 + `.venv` installed |
| 2–4 | AI Tutor integration (Claude), prompt config, streaming, level/language selection, math/code formatting | Working (free demo via Groq) | Provider switch `LLM_PROVIDER=groq|claude`. Groq `openai/gpt-oss-120b` tested OK in English, Arabic, Persian, Urdu. Claude path built (Haiku 4.5 only, 600-token cap) but Anthropic account has no credits yet — flip `LLM_PROVIDER=claude` after buying credits |
| 5–6 | STT/TTS integration (ElevenLabs Scribe + TTS) | Built, blocked on account | `/api/tts`, `/api/stt`, mic + read-aloud UI added. ElevenLabs returns `401 detected_unusual_activity` (Free Tier disabled; needs paid plan) |
| 7 | Multilingual + RTL validation (Urdu, Arabic, Persian) | Not started | RTL CSS/JS toggle scaffolded; needs real testing once chat works |
| 8–9 | Live AI voice agent (ElevenLabs Agent) | Not started | Needs `ELEVENLABS_AGENT_ID` |
| 10 | Institutional branding + UI/UX pass | Not started | |
| 11 | Deployment, security, usage/cost controls | Partially started | In-memory per-user daily cap (`backend/usage.py`). Deployment = local, run from this folder, for now |
| 12 | Internal QA + academic validation | Not started | |
| 13 | Controlled student pilot + fixes | Not started | |
| 14 | Final UAT + Go-Live | Not started | |

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
