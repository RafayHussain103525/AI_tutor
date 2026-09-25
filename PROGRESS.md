# AI Tutor — Progress Tracker

Tracks the 14-day compressed plan against what's actually done. Updated after every work session.

## Plan vs. Status

| Day | Activity | Status | Notes |
|---|---|---|---|
| 1 | Env setup, API credentials, config, repo | Done | Repo initialized, `.env.example`, config module, git init + first commit |
| 2–4 | AI Tutor integration (Gemini), prompt config, streaming, level/language selection, math/code formatting | In progress | Backend + frontend built; **not yet run/verified — Python not installed on this machine, no real Gemini API key added yet** |
| 5–6 | STT/TTS integration (ElevenLabs Scribe + TTS) | Not started | |
| 7 | Multilingual + RTL validation (Urdu, Arabic, Persian) | Not started | RTL CSS/JS toggle already scaffolded in frontend, needs real testing |
| 8–9 | Live AI voice agent (ElevenLabs Agent) | Not started | |
| 10 | Institutional branding + UI/UX pass | Not started | |
| 11 | HTTPS deployment, security, usage/cost controls | Partially started | In-memory per-user daily cap exists (`backend/usage.py`) — needs persistent store + real deployment before this counts as done |
| 12 | Internal QA + academic validation | Not started | |
| 13 | Controlled student pilot + fixes | Not started | |
| 14 | Final UAT + Go-Live | Not started | |

## What exists right now

- `backend/main.py` — FastAPI app, `/api/chat` (streaming), `/api/config`
- `backend/llm.py` — Gemini integration, level/language-aware system prompts, streaming
- `backend/usage.py` — per-user daily message cap (in-memory)
- `backend/config.py` — env-driven settings (Gemini model, ElevenLabs keys, limits, supported languages/levels)
- `frontend/index.html`, `app.js`, `style.css` — chat UI, level/language selectors, Markdown + KaTeX rendering, RTL layout switch
- `.env.example`, `.gitignore`, `requirements.txt`, `README.md`, `.claude/launch.json`

## Known blockers

- **Python is not installed** on this machine — only the Windows Store execution-alias stub exists. Nothing has been run or tested yet; this is unverified code.
- **No real `GEMINI_API_KEY`** has been added to `.env` — LLM calls have not been tested.
- Model ID `gemini-3.8` (used per user instruction) is unverified — confirm against actual Gemini API access before relying on it.
- ElevenLabs keys/IDs not yet configured — voice work (Days 5–6, 8–9) can't start until these exist.

## Decisions made

- Switched LLM provider from Anthropic to Gemini 3.8 (user instruction, 2026-09-24).
- Compressed original 25-day proposal timeline to 14 days by merging phases and running QA continuously instead of as an end block (see plan comparison in chat history) — same scope, less buffer for surprises.
- Usage/cost control implemented as in-memory counter for now; flagged as needing a real store before pilot goes live on a shared server.

---
*Last updated: 2026-09-25*
