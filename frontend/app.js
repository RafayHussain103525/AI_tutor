const RTL_LANGUAGES = new Set(["ur", "ar", "fa"]);
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

let currentConvId = null; // null = a new chat that hasn't been saved yet
let busy = false;

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

const voiceLangEl = $("voice-lang");

function applyLanguageDirection() {
  const rtl = RTL_LANGUAGES.has(languageEl.value);
  messageEl.dir = rtl ? "rtl" : "ltr";
  voiceLangEl.value = languageEl.value; // keep the mic's language picker in sync
}
languageEl.addEventListener("change", applyLanguageDirection);
voiceLangEl.addEventListener("change", () => {
  languageEl.value = voiceLangEl.value;
  applyLanguageDirection();
});

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
  startNewChat();
  closeMenu();
});

function startNewChat() {
  stopSpeaking();
  currentConvId = null;
  chatEl.querySelectorAll(".msg").forEach((n) => n.remove());
  emptyEl.hidden = false;
  messageEl.value = "";
  autoGrow();
  updateSend();
  setStatus("");
  markActiveChat();
  messageEl.focus();
}

// Mobile sidebar
function closeMenu() {
  appEl.classList.remove("menu-open");
}
$("menu").addEventListener("click", () => appEl.classList.add("menu-open"));
$("backdrop").addEventListener("click", closeMenu);

// ---------- Chat ----------

let sentByVoice = false;

// The server appends this when the model hit its length limit mid-answer.
const TRUNC_MARK = "[[LUMA_TRUNCATED]]";

function addContinueButton(body) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "continue-btn";
  btn.textContent = "Continue generating";
  btn.addEventListener("click", () => {
    btn.remove();
    messageEl.value = "Continue exactly where you stopped.";
    updateSend();
    formEl.requestSubmit();
  });
  body.appendChild(btn);
}

// Guess the language from the script of the student's message (null = can't tell / Latin).
function detectLanguage(text) {
  const arabicScript = (text.match(/[؀-ۿ]/g) || []).length;
  const latin = (text.match(/[A-Za-z]/g) || []).length;
  if (arabicScript === 0 || arabicScript < latin) return null;
  if (/[ٹڈڑںےہھ]/.test(text)) return "ur";
  if (/[ژی]/.test(text) && /[پچگ]/.test(text) && !/[ىي]/.test(text)) {
    return languageEl.value === "ur" ? "ur" : "fa";
  }
  return ["ur", "ar", "fa"].includes(languageEl.value) ? languageEl.value : "ar";
}

// In voice mode the model starts with <speak>short spoken answer</speak>, followed by
// the detailed written answer. Show only the written part; read the spoken part aloud.
function splitSpoken(full) {
  const m = full.match(/<speak>([\s\S]*?)(<\/speak>|$)/);
  if (!m) return { spoken: "", text: full.trim() };
  return { spoken: m[1].trim(), text: full.replace(m[0], "").trim() };
}

function firstSentences(text, n = 3) {
  const plain = text.replace(/```[\s\S]*?```/g, " ");
  return (plain.match(/[^.!?؟۔\n]+[.!?؟۔]?/g) || [plain]).slice(0, n).join(" ");
}

formEl.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (recorder) {
    finishRecording(true);
    return;
  }
  const message = messageEl.value.trim();
  if (!message || busy) return;

  const level = levelEl.value;
  const language = detectLanguage(message) || languageEl.value;
  if (language !== languageEl.value) {
    languageEl.value = language;
    applyLanguageDirection();
  }
  // Voice in -> voice out; also when "Read answers aloud" is on.
  const voiceMode = sentByVoice || speakEl.checked;
  sentByVoice = false;

  stopSpeaking();
  addMessage("user", message, language);
  messageEl.value = "";
  autoGrow();
  busy = true;
  updateSend();

  const assistantBody = addMessage("assistant", "", language);
  showTyping(assistantBody);
  let fullText = "";
  let speechStarted = false;

  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message,
        conversation_id: currentConvId,
        level,
        language,
        subject: subjectEl.value,
        voice_mode: voiceMode,
      }),
    });

    if (res.status === 401) {
      assistantBody.closest(".msg").remove();
      showLogin("Your session expired. Please sign in again.");
      return;
    }
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      assistantBody.textContent = err.detail || `Error: ${res.status}`;
      return;
    }
    const convId = res.headers.get("X-Conversation-Id");
    if (convId) currentConvId = convId;

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      fullText += decoder.decode(value, { stream: true });
      const { text: shown } = splitSpoken(fullText.replace(TRUNC_MARK, ""));
      if (shown) renderInto(assistantBody, shown);
      scrollToBottom();
      // Start talking as soon as the short spoken part is complete, while the
      // detailed written answer is still streaming.
      if (voiceMode && !speechStarted) {
        const m = fullText.match(/<speak>([\s\S]*?)<\/speak>/);
        if (m && m[1].trim()) {
          speechStarted = true;
          speak(m[1].trim());
        }
      }
    }
    const truncated = fullText.includes(TRUNC_MARK);
    const { spoken, text: finalText } = splitSpoken(fullText.replace(TRUNC_MARK, ""));
    const shownText = finalText || spoken;
    renderInto(assistantBody, shownText);
    if (truncated) addContinueButton(assistantBody);
    if (voiceMode && !speechStarted && shownText) speak(spoken || firstSentences(shownText));
  } catch (err) {
    assistantBody.textContent = "Network error: " + err.message;
  } finally {
    busy = false;
    updateSend();
    messageEl.focus();
    if (currentConvId) loadHistory();
  }
});

// ---------- Voice output (speaking animation) ----------
// Audio is generated on the server (neural voices), so it sounds the same in every browser.

let currentAudio = null;
let speakToken = 0;

function setSpeaking(on) {
  speakingEl.hidden = !on;
}

function stopSpeaking() {
  speakToken++;
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

// Voice gender (Female / Male), remembered between visits
let voiceGender = "female";
try {
  voiceGender = localStorage.getItem("tutor_voice_gender") || "female";
} catch (_) {}

function renderGender() {
  document.querySelectorAll("#voice-gender .seg-btn").forEach((b) => {
    const on = b.dataset.gender === voiceGender;
    b.classList.toggle("active", on);
    b.setAttribute("aria-checked", on);
  });
}
document.querySelectorAll("#voice-gender .seg-btn").forEach((b) =>
  b.addEventListener("click", () => {
    voiceGender = b.dataset.gender;
    try {
      localStorage.setItem("tutor_voice_gender", voiceGender);
    } catch (_) {}
    renderGender();
  })
);
renderGender();

// Split into sentence-sized chunks (merged to >= ~70 chars) so the first one can play
// while the rest are still being generated.
function chunkText(text, min = 90) {
  const sentences = text.match(/[^.!?؟۔\n]+[.!?؟۔]?/g) || [text];
  const chunks = [];
  let cur = "";
  for (const s of sentences) {
    cur += s + " ";
    // First chunk is just the first sentence, so audio starts as early as possible
    if (cur.trim().length >= (chunks.length ? min : 1)) {
      chunks.push(cur.trim());
      cur = "";
    }
  }
  if (cur.trim()) chunks.push(cur.trim());
  return chunks;
}

async function fetchSpeech(text) {
  const res = await fetch("/api/tts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, gender: voiceGender, language: languageEl.value }),
  });
  if (!res.ok) throw new Error(res.status);
  return res.blob();
}

function playBlob(blob) {
  return new Promise((resolve) => {
    const audio = new Audio(URL.createObjectURL(blob));
    currentAudio = audio;
    audio.onended = audio.onpause = audio.onerror = () => resolve();
    audio.play().catch(() => resolve());
  });
}

async function speak(text) {
  const token = ++speakToken;
  const plain = text
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/\$\$[\s\S]*?\$\$/g, " ")
    .replace(/\\\[[\s\S]*?\\\]/g, " ")
    .replace(/[*#`$_\\]/g, "")
    .trim();
  if (!plain) return;

  // Request every chunk at once; play them in order as each one arrives.
  const jobs = chunkText(plain).map((c) => {
    const p = fetchSpeech(c);
    p.catch(() => {});
    return p;
  });
  setSpeaking(true);
  try {
    for (const job of jobs) {
      const blob = await job;
      if (token !== speakToken) return; // cancelled or superseded
      await playBlob(blob);
      if (token !== speakToken) return;
    }
    setSpeaking(false);
  } catch (err) {
    if (token !== speakToken) return;
    setSpeaking(false);
    setStatus("Voice is unavailable right now (" + err.message + "). The written answer is above.");
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
      // The chosen language is a hint; the server double-checks it against auto-detection
      fd.append("language", languageEl.value);
      try {
        const res = await fetch("/api/stt", { method: "POST", body: fd });
        if (!res.ok) throw new Error(res.status);
        const { text, language: spokenLang } = await res.json();
        if (!text || !text.trim()) {
          setStatus("I couldn't hear anything. Please try again a little closer to the microphone.");
          return;
        }
        if (spokenLang && spokenLang !== languageEl.value) {
          languageEl.value = spokenLang; // the server heard a different language than selected
          applyLanguageDirection();
        }
        messageEl.value = (messageEl.value ? messageEl.value + " " : "") + text.trim();
        autoGrow();
        updateSend();
        messageEl.focus();
        setStatus("");
        if (autoSend && messageEl.value.trim()) {
          sentByVoice = true;
          formEl.requestSubmit();
        }
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

// ---------- Accounts & chat history ----------

const loginEl = $("login");
const loginErrorEl = $("login-error");
const historyEl = $("history");
let appConfig = {};

function showLogin(message = "") {
  stopSpeaking();
  appEl.hidden = true;
  loginEl.hidden = false;
  loginErrorEl.textContent = message;
  renderLoginButton();
}

function showApp(user) {
  loginEl.hidden = true;
  appEl.hidden = false;
  const label = user.name || user.email;
  $("user-name").textContent = label;
  $("user-email").textContent = user.email;
  const pic = $("user-pic");
  const initial = $("user-initial");
  if (user.picture) {
    pic.referrerPolicy = "no-referrer";
    pic.src = user.picture;
    pic.hidden = false;
    initial.hidden = true;
  } else {
    pic.hidden = true;
    initial.hidden = false;
    initial.textContent = label[0].toUpperCase();
  }
  startNewChat();
  loadHistory();
}

function renderLoginButton() {
  const domain = appConfig.allowed_email_domain || "tuf.edu.pk";
  $("login-domain").textContent = "@" + domain;
  $("dev-login").hidden = !appConfig.dev_login;
  const holder = $("g-btn");
  holder.innerHTML = "";
  if (!appConfig.google_client_id) {
    if (!appConfig.dev_login) loginErrorEl.textContent = "Sign-in is not configured yet. Please contact the administrator.";
    return;
  }
  let tries = 0;
  const draw = () => {
    if (!window.google || !google.accounts) {
      if (++tries < 50) return setTimeout(draw, 200);
      loginErrorEl.textContent = "Could not load Google sign-in. Check your internet connection and refresh.";
      return;
    }
    google.accounts.id.initialize({ client_id: appConfig.google_client_id, callback: onGoogleCredential });
    google.accounts.id.renderButton(holder, { theme: "filled_black", size: "large", shape: "pill", text: "signin_with", width: 280 });
  };
  draw();
}

async function onGoogleCredential(resp) {
  loginErrorEl.textContent = "";
  try {
    const res = await fetch("/api/auth/google", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ credential: resp.credential }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      loginErrorEl.textContent = data.detail || "Sign-in failed.";
      return;
    }
    showApp(data);
  } catch (err) {
    loginErrorEl.textContent = "Network error: " + err.message;
  }
}

$("dev-login").addEventListener("submit", async (e) => {
  e.preventDefault();
  loginErrorEl.textContent = "";
  const res = await fetch("/api/auth/dev", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: $("dev-email").value }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    loginErrorEl.textContent = data.detail || "Sign-in failed.";
    return;
  }
  showApp(data);
});

$("logout").addEventListener("click", async () => {
  await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
  if (window.google && google.accounts) google.accounts.id.disableAutoSelect();
  historyEl.innerHTML = "";
  showLogin();
});

// ----- Chat list -----

const TRASH_SVG =
  '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6"/></svg>';
const PENCIL_SVG =
  '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>';

function groupLabel(ts) {
  const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const days = Math.round((startOfDay(new Date()) - startOfDay(new Date(ts * 1000))) / 86400000);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return "Previous 7 days";
  if (days < 30) return "Previous 30 days";
  return "Older";
}

async function loadHistory() {
  let list;
  try {
    const res = await fetch("/api/conversations");
    if (res.status === 401) return showLogin("Your session expired. Please sign in again.");
    if (!res.ok) return;
    list = await res.json();
  } catch (_) {
    return;
  }
  historyEl.innerHTML = "";
  if (!list.length) {
    historyEl.innerHTML = '<div class="history-empty">Your chats will appear here.</div>';
    return;
  }
  let lastGroup = "";
  for (const c of list) {
    const group = groupLabel(c.updated);
    if (group !== lastGroup) {
      const label = document.createElement("div");
      label.className = "history-label";
      label.textContent = group;
      historyEl.appendChild(label);
      lastGroup = group;
    }
    const item = document.createElement("div");
    item.className = "chat-item";
    item.dataset.id = c.id;
    const open = document.createElement("button");
    open.type = "button";
    open.className = "chat-title";
    open.textContent = c.title;
    open.title = c.title;
    open.dir = "auto";
    open.addEventListener("click", () => openConversation(c.id));
    const rename = document.createElement("button");
    rename.type = "button";
    rename.className = "chat-act";
    rename.title = "Rename";
    rename.setAttribute("aria-label", "Rename chat");
    rename.innerHTML = PENCIL_SVG;
    rename.addEventListener("click", () => renameConversation(c.id, c.title));
    const del = document.createElement("button");
    del.type = "button";
    del.className = "chat-act danger";
    del.title = "Delete";
    del.setAttribute("aria-label", "Delete chat");
    del.innerHTML = TRASH_SVG;
    del.addEventListener("click", () => deleteConversation(c.id));
    item.append(open, rename, del);
    historyEl.appendChild(item);
  }
  markActiveChat();
}

function markActiveChat() {
  historyEl.querySelectorAll(".chat-item").forEach((el) => el.classList.toggle("active", el.dataset.id === currentConvId));
}

async function openConversation(id) {
  if (busy || id === currentConvId) {
    closeMenu();
    return;
  }
  const res = await fetch("/api/conversations/" + id);
  if (res.status === 401) return showLogin("Your session expired. Please sign in again.");
  if (!res.ok) {
    setStatus("Could not open that chat.");
    return;
  }
  const conv = await res.json();
  startNewChat();
  currentConvId = conv.id;
  for (const m of conv.messages) {
    const lang = detectLanguage(m.content) || languageEl.value;
    addMessage(m.role, m.content, RTL_LANGUAGES.has(lang) ? lang : "en");
  }
  markActiveChat();
  closeMenu();
  scrollToBottom();
}

async function renameConversation(id, current) {
  const title = prompt("Rename chat", current);
  if (!title || !title.trim() || title.trim() === current) return;
  await fetch("/api/conversations/" + id, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title: title.trim() }),
  });
  loadHistory();
}

async function deleteConversation(id) {
  if (!confirm("Delete this chat? This cannot be undone.")) return;
  await fetch("/api/conversations/" + id, { method: "DELETE" });
  if (id === currentConvId) startNewChat();
  loadHistory();
}

// ----- Start -----

applyLanguageDirection();
updateSend();

(async function boot() {
  try {
    appConfig = await (await fetch("/api/config")).json();
  } catch (_) {}
  try {
    const res = await fetch("/api/auth/me");
    if (res.ok) return showApp(await res.json());
  } catch (_) {}
  showLogin();
})();
