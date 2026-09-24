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

function renderBubble(role, text, lang) {
  const bubble = document.createElement("div");
  bubble.className = `bubble ${role}`;
  if (RTL_LANGUAGES.has(lang)) bubble.dir = "rtl";
  bubble.innerHTML = marked.parse(text || "");
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
      assistantBubble.innerHTML = marked.parse(fullText);
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
  } catch (err) {
    assistantBubble.textContent = "Network error: " + err.message;
  } finally {
    statusEl.textContent = "";
  }
});
