from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from . import config, usage
from .llm import stream_tutor_reply

app = FastAPI(title="AI-Powered Multilingual Tutor")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class ChatTurn(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    user_id: str
    message: str
    level: str = "undergraduate"
    language: str = "en"
    history: list[ChatTurn] = []


@app.get("/api/config")
def get_public_config():
    return {
        "languages": config.SUPPORTED_LANGUAGES,
        "rtl_languages": list(config.RTL_LANGUAGES),
        "levels": config.ACADEMIC_LEVELS,
        "max_messages_per_day": config.MAX_MESSAGES_PER_USER_PER_DAY,
    }


@app.post("/api/chat")
async def chat(req: ChatRequest):
    if req.level not in config.ACADEMIC_LEVELS:
        raise HTTPException(400, f"Invalid level: {req.level}")
    if req.language not in config.SUPPORTED_LANGUAGES:
        raise HTTPException(400, f"Unsupported language: {req.language}")

    allowed, remaining = usage.check_and_increment(req.user_id)
    if not allowed:
        raise HTTPException(429, "Daily message limit reached for this pilot account.")

    history = [turn.model_dump() for turn in req.history]

    async def event_stream():
        try:
            async for piece in stream_tutor_reply(req.message, req.level, req.language, history):
                yield piece
        except Exception as exc:
            yield f"\n\n[Error generating response: {exc}]"

    return StreamingResponse(event_stream(), media_type="text/plain")


app.mount("/", StaticFiles(directory="frontend", html=True), name="frontend")
