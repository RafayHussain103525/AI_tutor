# LUMA — Learning & University Mentor Assistant (Pilot)

Day 1–2 scaffold: FastAPI backend + Claude (Haiku) streaming chat, static frontend with
level/language selection, LaTeX/Markdown rendering, and RTL support for Urdu/Arabic/Persian.

## Setup

```bash
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
```

Set `LLM_PROVIDER=groq` (free tier, needs `GROQ_API_KEY`) or `LLM_PROVIDER=claude` (needs Anthropic credits). Edit `.env` and set `ANTHROPIC_API_KEY` (and ElevenLabs keys once voice work starts).

## Run

```bash
uvicorn backend.main:app --reload --port 8000
```

Open http://localhost:8000

## Status vs. 14-day plan

- [x] Day 1 — environment/config scaffold
- [x] Day 2–4 (partial) — Claude text tutor, streaming, level/language prompts, math/code formatting
- [ ] Day 5–6 — STT/TTS (ElevenLabs)
- [ ] Day 7 — Multilingual/RTL validation pass
- [ ] Day 8–9 — Live voice agent
- [ ] Day 10 — Branding/UI polish
- [ ] Day 11 — HTTPS deployment + usage/cost controls (basic per-user daily cap already in `backend/usage.py`, needs persistent store before real deployment)
- [ ] Day 12–14 — QA, pilot, UAT, go-live

## Notes

- `backend/usage.py` uses an in-memory counter — fine for local dev, replace with Redis/DB before the pilot goes live on a real server (process restarts reset counts).
- The Claude model is fixed server-side to Haiku 4.5 with a 600-token reply cap (pilot cost restriction). See `ALLOWED_CLAUDE_MODELS` in `backend/config.py` to widen it later.
