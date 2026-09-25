const RTL_LANGUAGES = new Set(["ur", "ar", "fa"]);

const chatEl = document.getElementById("chat");
const formEl = document.getElementById("chat-form");
const messageEl = document.getElementById("message");
const levelEl = document.getElementById("level");
const languageEl = document.getElementById("language");
const statusEl = document.getElementById("status");

const userId = getOrCreateUserId();
const history = [];

function getOrCreateUserId() {
  let id = localStorage.getItem("tutor_user_id");
  if (!id) {
    id = "pilot-" + Math.random().toString(36).slice(2, 10);
    localStorage.setItem("tutor_user_id", id);
  }
  return id;
}

// Some models emit \[...\] and \(...\); convert to $$...$$ and $...$ so marked
// doesn't strip the backslashes and KaTeX auto-render picks them up.
function normalizeMath(text) {
  return text
    .replace(/\\\[([\s\S]*?)\\\]/g, (_, m) => `$$${m}$$`)
    .replace(/\\\(([\s\S]*?)\\\)/g, (_, m) => `$${m}$`);
}

function renderBubble(role, text, lang) {
  const bubble = document.createElement("div");
  bubble.className = `bubble ${role}`;
  if (RTL_LANGUAGES.has(lang)) bubble.dir = "rtl";
  bubble.innerHTML = marked.parse(normalizeMath(text || ""));
  chatEl.appendChild(bubble);
  chatEl.scrollTop = chatEl.scrollHeight;
  if (window.renderMathInElement) {
    renderMathInElement(bubble, {
      delimiters: [
        { left: "$$", right: "$$", display: true },
        { left: "$", right: "$", display: false },
      ],
    });
  }
  return bubble;
}

formEl.addEventListener("submit", async (e) => {
  e.preventDefault();
  const message = messageEl.value.trim();
  if (!message) return;

  const level = levelEl.value;
  const language = languageEl.value;

  renderBubble("user", message, language);
  history.push({ role: "user", content: message });
  messageEl.value = "";
  statusEl.textContent = "Thinking...";

  const assistantBubble = renderBubble("assistant", "", language);
  let fullText = "";

  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: userId, message, level, language, history }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      assistantBubble.textContent = err.detail || `Error: ${res.status}`;
      statusEl.textContent = "";
      return;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      fullText += decoder.decode(value, { stream: true });
      assistantBubble.innerHTML = marked.parse(normalizeMath(fullText));
      if (window.renderMathInElement) {
        renderMathInElement(assistantBubble, {
          delimiters: [
            { left: "$$", right: "$$", display: true },
            { left: "$", right: "$", display: false },
          ],
        });
      }
      chatEl.scrollTop = chatEl.scrollHeight;
    }
    history.push({ role: "assistant", content: fullText });
    if (speakEl.checked) speak(fullText);
  } catch (err) {
    assistantBubble.textContent = "Network error: " + err.message;
  } finally {
    statusEl.textContent = "";
  }
});

const speakEl = document.getElementById("speak");
const micEl = document.getElementById("mic");
let recorder = null;

async function speak(text) {
  try {
    const plain = text.replace(/```[\s\S]*?```/g, " ").replace(/[*#`$]/g, "");
    const res = await fetch("/api/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: plain }),
    });
    if (!res.ok) throw new Error(res.status);
    new Audio(URL.createObjectURL(await res.blob())).play();
  } catch (err) {
    statusEl.textContent = "Voice playback failed: " + err.message;
  }
}

micEl.addEventListener("click", async () => {
  if (recorder) {
    recorder.stop();
    return;
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const chunks = [];
    recorder = new MediaRecorder(stream);
    recorder.ondataavailable = (e) => chunks.push(e.data);
    recorder.onstop = async () => {
      stream.getTracks().forEach((t) => t.stop());
      recorder = null;
      micEl.textContent = "\u{1F3A4}";
      statusEl.textContent = "Transcribing...";
      const fd = new FormData();
      fd.append("file", new Blob(chunks, { type: "audio/webm" }), "audio.webm");
      fd.append("language", languageEl.value);
      try {
        const res = await fetch("/api/stt", { method: "POST", body: fd });
        if (!res.ok) throw new Error(res.status);
        messageEl.value = (await res.json()).text;
        statusEl.textContent = "";
      } catch (err) {
        statusEl.textContent = "Transcription failed: " + err.message;
      }
    };
    recorder.start();
    micEl.textContent = "\u23F9";
  } catch (err) {
    statusEl.textContent = "Microphone unavailable: " + err.message;
  }
});
