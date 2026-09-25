import re

from fastapi import Depends, FastAPI, File, Form, HTTPException, UploadFile
from fastapi.responses import Response, StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from . import auth, config, db, usage, voice
from .llm import TRUNCATED_MARK, stream_tutor_reply

app = FastAPI(title="LUMA - Learning & University Mentor Assistant")
app.include_router(auth.router)

HISTORY_TURNS = 20  # previous messages sent to the model as context


@app.on_event("startup")
async def _warm_voices():
    import asyncio

    asyncio.create_task(voice.warm_up())


@app.middleware("http")
async def no_cache(request, call_next):
    response = await call_next(request)
    response.headers["Cache-Control"] = "no-cache"
    return response


class ChatRequest(BaseModel):
    message: str
    conversation_id: str | None = None
    level: str = "undergraduate"
    subject: str = ""
    voice_mode: bool = False
    language: str = "en"


@app.get("/api/config")
def get_public_config():
    return {
        "languages": config.SUPPORTED_LANGUAGES,
        "rtl_languages": list(config.RTL_LANGUAGES),
        "levels": config.ACADEMIC_LEVELS,
        "max_messages_per_day": config.MAX_MESSAGES_PER_USER_PER_DAY,
        "voice_provider": config.VOICE_PROVIDER,
        "tts_provider": config.TTS_PROVIDER,
        "google_client_id": config.GOOGLE_CLIENT_ID,
        "allowed_email_domain": config.ALLOWED_EMAIL_DOMAIN,
        "dev_login": config.DEV_LOGIN,
    }


# ---------- Chat history ----------

@app.get("/api/conversations")
def list_conversations(user: dict = Depends(auth.current_user)):
    return db.list_conversations(user["email"])


@app.get("/api/conversations/{cid}")
def get_conversation(cid: str, user: dict = Depends(auth.current_user)):
    conv = db.get_conversation(user["email"], cid)
    if not conv:
        raise HTTPException(404, "Conversation not found")
    return {**conv, "messages": db.get_messages(cid)}


class RenameRequest(BaseModel):
    title: str


@app.patch("/api/conversations/{cid}")
def rename_conversation(cid: str, body: RenameRequest, user: dict = Depends(auth.current_user)):
    title = body.title.strip()[:120]
    if not title:
        raise HTTPException(400, "Title cannot be empty")
    if not db.rename_conversation(user["email"], cid, title):
        raise HTTPException(404, "Conversation not found")
    return {"ok": True}


@app.delete("/api/conversations/{cid}")
def delete_conversation(cid: str, user: dict = Depends(auth.current_user)):
    if not db.delete_conversation(user["email"], cid):
        raise HTTPException(404, "Conversation not found")
    return {"ok": True}


# ---------- Chat ----------

def _clean_reply(text: str) -> str:
    """What gets saved: the written answer only (no spoken part, no truncation marker)."""
    text = text.replace(TRUNCATED_MARK, "")
    text = re.sub(r"<speak>[\s\S]*?(</speak>|$)", "", text).strip()
    return text


def _make_title(message: str) -> str:
    title = " ".join(message.split())
    return (title[:57] + "…") if len(title) > 58 else title


@app.post("/api/chat")
async def chat(req: ChatRequest, user: dict = Depends(auth.current_user)):
    if req.level not in config.ACADEMIC_LEVELS:
        raise HTTPException(400, f"Invalid level: {req.level}")
    if req.language not in config.SUPPORTED_LANGUAGES:
        raise HTTPException(400, f"Unsupported language: {req.language}")
    message = req.message.strip()
    if not message:
        raise HTTPException(400, "Message is empty")
    if len(message) > 4000:
        raise HTTPException(400, "Message is too long (max 4000 characters)")

    email = user["email"]
    if req.conversation_id:
        if not db.get_conversation(email, req.conversation_id):
            raise HTTPException(404, "Conversation not found")
        cid = req.conversation_id
    else:
        cid = None

    allowed, _remaining = usage.check_and_increment(email)
    if not allowed:
        raise HTTPException(429, "Daily message limit reached for this pilot account.")

    if cid is None:
        cid = db.create_conversation(email, _make_title(message))
    history = db.get_messages(cid, limit=HISTORY_TURNS)
    db.add_message(cid, "user", message)

    async def event_stream():
        collected = ""
        failed = False
        try:
            async for piece in stream_tutor_reply(
                message, req.level, req.language, history, req.subject.strip()[:100], req.voice_mode
            ):
                collected += piece
                yield piece
        except Exception as exc:
            failed = True
            yield f"\n\n[Error generating response: {exc}]"
        finally:
            reply = _clean_reply(collected)
            if reply and not failed:
                db.add_message(cid, "assistant", reply)

    return StreamingResponse(
        event_stream(),
        media_type="text/plain",
        headers={"X-Conversation-Id": cid, "Access-Control-Expose-Headers": "X-Conversation-Id"},
    )


# ---------- Voice ----------

class TTSRequest(BaseModel):
    text: str
    gender: str = "female"
    language: str = "en"


@app.post("/api/tts")
async def tts(req: TTSRequest, user: dict = Depends(auth.current_user)):
    try:
        audio = await voice.text_to_speech(req.text[:2500], req.gender, req.language)
    except Exception as exc:
        raise HTTPException(502, f"TTS failed: {exc}")
    return Response(audio, media_type="audio/mpeg")


@app.post("/api/stt")
async def stt(file: UploadFile = File(...), language: str = Form(""), user: dict = Depends(auth.current_user)):
    try:
        text = await voice.speech_to_text(
            await file.read(), file.filename or "audio.webm", file.content_type or "audio/webm", language or None
        )
    except Exception as exc:
        raise HTTPException(502, f"STT failed: {exc}")
    return {"text": text}


app.mount("/", StaticFiles(directory="frontend", html=True), name="frontend")
