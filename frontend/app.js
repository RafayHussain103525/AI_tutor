const RTL_LANGUAGES = new Set(["ur", "ar", "fa"]);
const SPEECH_LANGS = { en: "en-US", ur: "ur-PK", ar: "ar-SA", fa: "fa-IR" };
const MATH_DELIMS = [
  { left: "$$", right: "$$", display: true },
  { left: "$", right: "$", display: false },
];
const AVATAR_SVG =
  '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3 2 8l10 5 10-5-10-5Z"/><path d="M6 10.5V16c0 1.5 2.7 3 6 3s6-1.5 6-3v-5.5"/></svg>';

const $ = (id) => document.getElementById(id);
const appEl = $("app");
const chatEl = $("chat");
const emptyEl = $("empty");
const formEl = $("chat-form");
const messageEl = $("message");
const levelEl = $("level");
const languageEl = $("language");
const subjectEl = $("subject");
const statusEl = $("status");
const sendEl = $("send");
const micEl = $("mic");
const speakEl = $("speak");
const speakingEl = $("speaking");

const userId = getOrCreateUserId();
let history = [];
let busy = false;

function getOrCreateUserId() {
  let id = localStorage.getItem("tutor_user_id");
  if (!id) {
    id = "pilot-" + Math.random().toString(36).slice(2, 10);
    localStorage.setItem("tutor_user_id", id);
  }
  return id;
}

// ---------- Rendering ----------

// Some models emit \[...\] and \(...\); convert to $$...$$ and $...$ so marked
// doesn't strip the backslashes and KaTeX auto-render picks them up.
function normalizeMath(text) {
  return text
    .replace(/\\\[([\s\S]*?)\\\]/g, (_, m) => `$$${m}$$`)
    .replace(/\\\(([\s\S]*?)\\\)/g, (_, m) => `$${m}$`);
}

function renderInto(el, text) {
  el.innerHTML = marked.parse(normalizeMath(text || ""));
  if (window.renderMathInElement) renderMathInElement(el, { delimiters: MATH_DELIMS });
}

function scrollToBottom() {
  chatEl.scrollTop = chatEl.scrollHeight;
}

function addMessage(role, text, lang) {
  emptyEl.hidden = true;
  const row = document.createElement("div");
  row.className = `msg ${role}`;
  if (role === "assistant") {
    const avatar = document.createElement("div");
    avatar.className = "avatar";
    avatar.innerHTML = AVATAR_SVG;
    row.appendChild(avatar);
  }
  const body = document.createElement("div");
  body.className = "body";
  if (RTL_LANGUAGES.has(lang)) body.dir = "rtl";
  if (role === "user") body.textContent = text;
  else if (text) renderInto(body, text);
  row.appendChild(body);
  chatEl.appendChild(row);
  scrollToBottom();
  return body;
}

function showTyping(body) {
  body.innerHTML = '<span class="typing"><i></i><i></i><i></i></span>';
}

function setStatus(text) {
  statusEl.textContent = text || "";
}

// ---------- Composer ----------

function updateSend() {
  sendEl.disabled = busy || (!recorder && !messageEl.value.trim());
}

function autoGrow() {
  messageEl.style.height = "auto";
  messageEl.style.height = Math.min(messageEl.scrollHeight, 180) + "px";
}

messageEl.addEventListener("input", () => {
  autoGrow();
  updateSend();
});

messageEl.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey && !e.isComposing) {
    e.preventDefault();
    if (!sendEl.disabled) formEl.requestSubmit();
  }
});

function applyLanguageDirection() {
  const rtl = RTL_LANGUAGES.has(languageEl.value);
  messageEl.dir = rtl ? "rtl" : "ltr";
}
languageEl.addEventListener("change", applyLanguageDirection);

document.querySelectorAll(".chip").forEach((chip) =>
  chip.addEventListener("click", () => {
    messageEl.value = chip.textContent;
    autoGrow();
    updateSend();
    formEl.requestSubmit();
  })
);

$("new-chat").addEventListener("click", () => {
  if (busy) return;
  stopSpeaking();
  history = [];
  chatEl.querySelectorAll(".msg").forEach((n) => n.remove());
  emptyEl.hidden = false;
  messageEl.value = "";
  autoGrow();
  updateSend();
  setStatus("");
  closeMenu();
  messageEl.focus();
});

// Mobile sidebar
function closeMenu() {
  appEl.classList.remove("menu-open");
}
$("menu").addEventListener("click", () => appEl.classList.add("menu-open"));
$("backdrop").addEventListener("click", closeMenu);

// ---------- Chat ----------

formEl.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (recorder) {
    finishRecording(true);
    return;
  }
  const message = messageEl.value.trim();
  if (!message || busy) return;

  const level = levelEl.value;
  const language = languageEl.value;

  stopSpeaking();
  addMessage("user", message, language);
  history.push({ role: "user", content: message });
  messageEl.value = "";
  autoGrow();
  busy = true;
  updateSend();

  const assistantBody = addMessage("assistant", "", language);
  showTyping(assistantBody);
  let fullText = "";

  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user_id: userId,
        message,
        level,
        language,
        subject: subjectEl.value,
        history: history.slice(0, -1),
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      assistantBody.textContent = err.detail || `Error: ${res.status}`;
      history.pop();
      return;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      fullText += decoder.decode(value, { stream: true });
      renderInto(assistantBody, fullText);
      scrollToBottom();
    }
    history.push({ role: "assistant", content: fullText });
    if (speakEl.checked && fullText) speak(fullText);
  } catch (err) {
    assistantBody.textContent = "Network error: " + err.message;
    history.pop();
  } finally {
    busy = false;
    updateSend();
    messageEl.focus();
  }
});

// ---------- Voice output (speaking animation) ----------

let voiceProvider = "groq";
fetch("/api/config")
  .then((r) => r.json())
  .then((c) => (voiceProvider = c.voice_provider))
  .catch(() => {});

let currentAudio = null;

function setSpeaking(on) {
  speakingEl.hidden = !on;
}

function stopSpeaking() {
  if (window.speechSynthesis) speechSynthesis.cancel();
  if (currentAudio) {
    currentAudio.pause();
    currentAudio = null;
  }
  setSpeaking(false);
}

$("stop-speaking").addEventListener("click", stopSpeaking);
speakEl.addEventListener("change", () => {
  if (!speakEl.checked) stopSpeaking();
});

function chunkText(text, max = 180) {
  const sentences = text.match(/[^.!?؟۔\n]+[.!?؟۔]?/g) || [text];
  const chunks = [];
  let cur = "";
  for (const s of sentences) {
    if ((cur + s).length > max && cur) {
      chunks.push(cur.trim());
      cur = "";
    }
    cur += s + " ";
  }
  if (cur.trim()) chunks.push(cur.trim());
  return chunks;
}

function speakInBrowser(plain) {
  if (!window.speechSynthesis) {
    setStatus("Read aloud is not supported in this browser.");
    return;
  }
  speechSynthesis.cancel();
  const lang = languageEl.value;
  const voice = speechSynthesis.getVoices().find((v) => v.lang.toLowerCase().startsWith(lang));
  if (!voice && lang !== "en") {
    setStatus("No installed voice for this language; add one in your OS speech settings.");
  }
  const chunks = chunkText(plain);
  chunks.forEach((chunk, i) => {
    const utter = new SpeechSynthesisUtterance(chunk);
    utter.lang = SPEECH_LANGS[lang] || "en-US";
    if (voice) utter.voice = voice;
    if (i === 0) utter.onstart = () => setSpeaking(true);
    if (i === chunks.length - 1) {
      utter.onend = () => setSpeaking(false);
    }
    utter.onerror = () => setSpeaking(false);
    speechSynthesis.speak(utter);
  });
}

async function speak(text) {
  try {
    const plain = text
      .replace(/```[\s\S]*?```/g, " ")
      .replace(/\$\$[\s\S]*?\$\$/g, " ")
      .replace(/\\\[[\s\S]*?\\\]/g, " ")
      .replace(/[*#`$_\\]/g, "");
    if (voiceProvider !== "elevenlabs") {
      speakInBrowser(plain);
      return;
    }
    const res = await fetch("/api/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: plain }),
    });
    if (!res.ok) throw new Error(res.status);
    currentAudio = new Audio(URL.createObjectURL(await res.blob()));
    currentAudio.onplay = () => setSpeaking(true);
    currentAudio.onended = currentAudio.onpause = () => setSpeaking(false);
    await currentAudio.play();
  } catch (err) {
    setSpeaking(false);
    setStatus("Voice playback failed: " + err.message);
  }
}

// ---------- Voice input (listening animation) ----------

let recorder = null;
let audioCtx = null;
let rafId = null;
let timerId = null;
const bars = Array.from(document.querySelectorAll("#bars i"));

function startMeter(stream) {
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  const analyser = audioCtx.createAnalyser();
  analyser.fftSize = 64;
  audioCtx.createMediaStreamSource(stream).connect(analyser);
  const data = new Uint8Array(analyser.frequencyBinCount);
  const tick = () => {
    analyser.getByteFrequencyData(data);
    bars.forEach((bar, i) => {
      const v = data[Math.min(i + 1, data.length - 1)] / 255;
      bar.style.height = Math.max(4, Math.round(v * 32)) + "px";
    });
    rafId = requestAnimationFrame(tick);
  };
  tick();
}

function stopMeter() {
  cancelAnimationFrame(rafId);
  clearInterval(timerId);
  if (audioCtx) audioCtx.close().catch(() => {});
  audioCtx = null;
  bars.forEach((b) => (b.style.height = ""));
}

function startTimer() {
  const label = $("rec-time");
  const start = Date.now();
  label.textContent = "0:00";
  timerId = setInterval(() => {
    const s = Math.floor((Date.now() - start) / 1000);
    label.textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  }, 250);
}

let autoSend = false;

function finishRecording(send) {
  autoSend = send;
  if (recorder && recorder.state !== "inactive") recorder.stop();
}

// Enter sends while recording (the textarea is hidden, so listen globally)
document.addEventListener("keydown", (e) => {
  if (recorder && e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    finishRecording(true);
  }
});

micEl.addEventListener("click", async () => {
  if (recorder) {
    finishRecording(false);
    return;
  }
  stopSpeaking();
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const chunks = [];
    recorder = new MediaRecorder(stream);
    recorder.ondataavailable = (e) => chunks.push(e.data);
    recorder.onstop = async () => {
      stream.getTracks().forEach((t) => t.stop());
      stopMeter();
      recorder = null;
      updateSend();
      formEl.classList.remove("recording");
      setStatus("Transcribing…");
      const fd = new FormData();
      fd.append("file", new Blob(chunks, { type: "audio/webm" }), "audio.webm");
      fd.append("language", languageEl.value);
      try {
        const res = await fetch("/api/stt", { method: "POST", body: fd });
        if (!res.ok) throw new Error(res.status);
        const { text } = await res.json();
        messageEl.value = (messageEl.value ? messageEl.value + " " : "") + text.trim();
        autoGrow();
        updateSend();
        messageEl.focus();
        setStatus("");
        if (autoSend && messageEl.value.trim()) formEl.requestSubmit();
      } catch (err) {
        setStatus("Transcription failed: " + err.message);
      }
      autoSend = false;
    };
    recorder.start();
    formEl.classList.add("recording");
    updateSend();
    setStatus("Listening… press Send or Enter to send, or tap the square to stop");
    startMeter(stream);
    startTimer();
  } catch (err) {
    setStatus("Microphone unavailable: " + err.message);
  }
});

applyLanguageDirection();
updateSend();
