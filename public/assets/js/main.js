let chatHistory = []; // [{role:'user'|'model', text:'...'}]
let isSending = false;
let currentTab = "text";
let selectedFiles = { image: null, document: null, audio: null };

function haptic(pattern = 15) {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    try {
      navigator.vibrate(pattern);
    } catch (_) {
      /* noop */
    }
  }
}

function showToast(msg, type = "error") {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.className = `fixed top-4 right-4 z-50 px-4 py-3 rounded-xl text-sm font-medium shadow-2xl max-w-xs transition-all duration-300 ${
    type === "error"
      ? "bg-red-500/90 text-white"
      : type === "success"
        ? "bg-jade-600/90 text-white"
        : "bg-slate-700/90 text-slate-200"
  }`;
  t.classList.remove("hidden");
  setTimeout(() => {
    t.classList.add("hidden");
  }, 3500);
}

function autoResize(el) {
  el.style.height = "auto";
  el.style.height = Math.min(el.scrollHeight, 128) + "px";
}

function scrollToBottom() {
  const scroll = document.getElementById("chatScroll");
  setTimeout(() => {
    scroll.scrollTop = scroll.scrollHeight;
  }, 50);
}

function hideWelcome() {
  const w = document.getElementById("welcomeScreen");
  if (w) w.style.display = "none";
}

function setBusy(busy) {
  isSending = busy;
  ["sendTextBtn", "sendImageBtn", "sendDocBtn", "sendAudioBtn"].forEach(
    (id) => {
      const btn = document.getElementById(id);
      if (btn) btn.disabled = busy;
    },
  );
}

function switchTab(tab) {
  haptic(8);
  currentTab = tab;
  document.querySelectorAll(".tab-btn").forEach((b) => {
    b.classList.toggle("active", b.dataset.tab === tab);
  });
  document.querySelectorAll(".tab-panel").forEach((p) => {
    p.classList.add("hidden");
  });
  document.getElementById(`panel-${tab}`).classList.remove("hidden");

  // Focus text input when switching to text
  if (tab === "text") {
    setTimeout(() => document.getElementById("textInput").focus(), 100);
  }
}

function appendUserMessage(content) {
  hideWelcome();
  const container = document.getElementById("messagesContainer");
  const div = document.createElement("div");
  div.className = "msg-enter flex justify-end mb-2";
  div.innerHTML = `
        <div class="bubble-user max-w-[75%] px-4 py-3 text-sm text-white leading-relaxed shadow-lg shadow-jade-900/30">
          ${escapeHtml(content)}
        </div>`;
  container.appendChild(div);
  scrollToBottom();
  return div;
}

function appendMediaMessage(icon, label, name) {
  hideWelcome();
  const container = document.getElementById("messagesContainer");
  const div = document.createElement("div");
  div.className = "msg-enter flex justify-end mb-2";
  div.innerHTML = `
        <div class="bubble-user max-w-[75%] px-4 py-3 text-sm text-white leading-relaxed shadow-lg shadow-jade-900/30">
          <div class="flex items-center gap-2">
            <span class="text-lg">${icon}</span>
            <div>
              <p class="font-medium text-xs text-jade-200">${label}</p>
              <p class="text-white/80 text-xs truncate-name truncate">${escapeHtml(name)}</p>
            </div>
          </div>
        </div>`;
  container.appendChild(div);
  scrollToBottom();
}

function appendTypingIndicator() {
  const container = document.getElementById("messagesContainer");
  const div = document.createElement("div");
  div.id = "typingIndicator";
  div.className = "msg-enter flex justify-start";
  div.innerHTML = `
        <div class="flex items-start gap-3 max-w-[85%] w-full">
          <div class="w-8 h-8 rounded-lg bg-jade-700 flex items-center justify-center text-base flex-shrink-0 mt-0.5">🩺</div>
          <div class="bubble-bot px-4 py-3 flex-1">
            <div class="flex gap-1.5 items-center h-4 mb-2">
              <span class="typing-dot"></span>
              <span class="typing-dot"></span>
              <span class="typing-dot"></span>
            </div>
            <div class="skeleton skeleton-line" style="width:92%"></div>
            <div class="skeleton skeleton-line" style="width:76%"></div>
            <div class="skeleton skeleton-line" style="width:60%"></div>
          </div>
        </div>`;
  container.appendChild(div);
  scrollToBottom();
}

function removeTypingIndicator() {
  const el = document.getElementById("typingIndicator");
  if (el) el.remove();
}

function appendBotMessage(text) {
  removeTypingIndicator();
  haptic(12);
  const container = document.getElementById("messagesContainer");
  const div = document.createElement("div");
  div.className = "msg-enter flex justify-start";

  const parsed = marked.parse(text || "");

  div.innerHTML = `
        <div class="flex items-start gap-3 max-w-[85%]">
          <div class="w-8 h-8 rounded-lg bg-jade-700 flex items-center justify-center text-base flex-shrink-0 mt-0.5">🩺</div>
          <div>
            <div class="bubble-bot px-4 py-3 text-sm text-slate-200 leading-relaxed">
              <div class="prose-health">${parsed}</div>
            </div>
            <div class="flex items-center gap-2 mt-1.5 px-1">
              <button onclick="copyText(this, ${JSON.stringify(text)})" class="text-xs text-slate-600 hover:text-jade-400 transition-colors flex items-center gap-1">
                <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2" stroke-width="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" stroke-width="2"/></svg>
                Salin
              </button>
              <span class="text-slate-700 text-xs">${new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}</span>
            </div>
          </div>
        </div>`;
  container.appendChild(div);
  scrollToBottom();
}

function appendErrorMessage(text) {
  removeTypingIndicator();
  haptic([30, 60, 30]);
  const container = document.getElementById("messagesContainer");
  const div = document.createElement("div");
  div.className = "msg-enter flex justify-start";
  div.innerHTML = `
        <div class="flex items-start gap-3 max-w-[85%]">
          <div class="w-8 h-8 rounded-lg bg-red-800/60 flex items-center justify-center text-base flex-shrink-0 mt-0.5">⚠️</div>
          <div class="bg-red-900/20 border border-red-500/20 rounded-xl px-4 py-3 text-sm text-red-400">
            ${escapeHtml(text)}
          </div>
        </div>`;
  container.appendChild(div);
  scrollToBottom();
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
    .replace(/\n/g, "<br>");
}

function copyText(btn, text) {
  navigator.clipboard
    .writeText(text)
    .then(() => {
      btn.textContent = "✓ Disalin";
      setTimeout(() => {
        btn.innerHTML = `<svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2" stroke-width="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" stroke-width="2"/></svg> Salin`;
      }, 2000);
    })
    .catch(() => showToast("Gagal menyalin teks"));
}

function clearChat() {
  chatHistory = [];
  document.getElementById("messagesContainer").innerHTML = "";
  document.getElementById("welcomeScreen").style.display = "";
  document.getElementById("textInput").value = "";
}

function askTopic(msg) {
  switchTab("text");
  const input = document.getElementById("textInput");
  input.value = msg;
  autoResize(input);
  sendText();
}

async function sendText() {
  const input = document.getElementById("textInput");
  const message = input.value.trim();
  if (!message || isSending) return;

  haptic(15);
  input.value = "";
  autoResize(input);
  setBusy(true);
  appendUserMessage(message);
  appendTypingIndicator();

  chatHistory.push({ role: "user", text: message });

  try {
    const res = await fetch("/api/chat/text", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, history: chatHistory.slice(0, -1) }),
    });
    const data = await res.json();

    if (!res.ok) throw new Error(data.error || "Server error");

    chatHistory.push({ role: "model", text: data.result });
    appendBotMessage(data.result);
  } catch (err) {
    chatHistory.pop(); // remove optimistic entry
    appendErrorMessage(err.message || "Terjadi kesalahan. Coba lagi.");
  } finally {
    setBusy(false);
  }
}

function handleTextKey(e) {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendText();
  }
}

function handleFileSelect(event, type) {
  const file = event.target.files[0];
  if (file) setSelectedFile(type, file);
}

function setSelectedFile(type, file) {
  selectedFiles[type] = file;

  const previewMap = {
    image: { area: "imagePreviewArea", icon: "🖼️", label: "Gambar dipilih" },
    document: { area: "docPreviewArea", icon: "📄", label: "Dokumen dipilih" },
    audio: { area: "audioPreviewArea", icon: "🎵", label: "Audio dipilih" },
  };

  const { area, icon, label } = previewMap[type];
  const previewEl = document.getElementById(area);

  let extra = "";
  if (type === "image" && file.type.startsWith("image/")) {
    const url = URL.createObjectURL(file);
    extra = `<img src="${url}" class="mt-2 max-h-24 rounded-lg object-contain" onload="URL.revokeObjectURL(this.src)"/>`;
  } else if (type === "audio") {
    const url = URL.createObjectURL(file);
    extra = `<audio controls class="mt-2 w-full max-w-xs" style="height:32px"><source src="${url}" type="${file.type}"></audio>`;
  }

  previewEl.innerHTML = `
        <div class="flex flex-col items-center gap-1">
          <span class="text-xl">${icon}</span>
          <p class="text-xs font-medium text-jade-400">${label}</p>
          <p class="text-xs text-slate-400 truncate-name truncate max-w-full px-2">${escapeHtml(file.name)}</p>
          <p class="text-xs text-slate-600">${(file.size / 1024 / 1024).toFixed(2)} MB</p>
          ${extra}
          <button onclick="clearFile('${type}')" class="mt-1 text-xs text-red-400 hover:text-red-300">✕ Hapus</button>
        </div>`;
}

function clearFile(type) {
  selectedFiles[type] = null;
  const inputMap = {
    image: "imageInput",
    document: "docInput",
    audio: "audioInput",
  };
  document.getElementById(inputMap[type]).value = "";

  const defaultsMap = {
    image: {
      area: "imagePreviewArea",
      icon: "🖼️",
      label: "Klik atau drag gambar ke sini",
      hint: "JPG, PNG, WEBP, GIF — maks 20MB",
    },
    document: {
      area: "docPreviewArea",
      icon: "📄",
      label: "Klik atau drag dokumen ke sini",
      hint: "PDF, TXT — maks 20MB",
    },
    audio: {
      area: "audioPreviewArea",
      icon: "🎵",
      label: "Klik atau drag file audio ke sini",
      hint: "MP3, WAV, OGG, M4A — maks 20MB",
    },
  };
  const { area, icon, label, hint } = defaultsMap[type];
  document.getElementById(area).innerHTML = `
        <span class="text-2xl">${icon}</span>
        <p class="text-sm text-slate-400">${label}</p>
        <p class="text-xs text-slate-600">${hint}</p>`;
}

function handleDragOver(e, zoneId) {
  e.preventDefault();
  document.getElementById(zoneId).classList.add("dragover");
}
function handleDragLeave(zoneId) {
  document.getElementById(zoneId).classList.remove("dragover");
}
function handleDrop(e, type) {
  e.preventDefault();
  const zoneMap = {
    image: "imageDropZone",
    document: "docDropZone",
    audio: "audioDropZone",
  };
  document.getElementById(zoneMap[type]).classList.remove("dragover");
  const file = e.dataTransfer.files[0];
  if (file) setSelectedFile(type, file);
}

async function sendImage() {
  if (!selectedFiles.image) {
    showToast("Pilih gambar terlebih dahulu.");
    return;
  }
  if (isSending) return;

  const prompt = document.getElementById("imagePrompt").value.trim();
  const file = selectedFiles.image;

  haptic(15);
  setBusy(true);
  appendMediaMessage("🖼️", "Gambar", file.name);
  if (prompt) appendUserMessage(prompt);
  appendTypingIndicator();

  const formData = new FormData();
  formData.append("image", file);
  if (prompt) formData.append("message", prompt);

  try {
    const res = await fetch("/api/chat/image", {
      method: "POST",
      body: formData,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Server error");
    chatHistory.push({
      role: "user",
      text: `[Gambar: ${file.name}] ${prompt}`,
    });
    chatHistory.push({ role: "model", text: data.result });
    appendBotMessage(data.result);
    clearFile("image");
    document.getElementById("imagePrompt").value = "";
  } catch (err) {
    appendErrorMessage(err.message || "Gagal menganalisis gambar.");
  } finally {
    setBusy(false);
  }
}

function handleImageKey(e) {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendImage();
  }
}

async function sendDocument() {
  if (!selectedFiles.document) {
    showToast("Pilih dokumen terlebih dahulu.");
    return;
  }
  if (isSending) return;

  const prompt = document.getElementById("docPrompt").value.trim();
  const file = selectedFiles.document;

  haptic(15);
  setBusy(true);
  appendMediaMessage("📄", "Dokumen", file.name);
  if (prompt) appendUserMessage(prompt);
  appendTypingIndicator();

  const formData = new FormData();
  formData.append("document", file);
  if (prompt) formData.append("message", prompt);

  try {
    const res = await fetch("/api/chat/document", {
      method: "POST",
      body: formData,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Server error");
    chatHistory.push({
      role: "user",
      text: `[Dokumen: ${file.name}] ${prompt}`,
    });
    chatHistory.push({ role: "model", text: data.result });
    appendBotMessage(data.result);
    clearFile("document");
    document.getElementById("docPrompt").value = "";
  } catch (err) {
    appendErrorMessage(err.message || "Gagal membaca dokumen.");
  } finally {
    setBusy(false);
  }
}

function handleDocKey(e) {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendDocument();
  }
}

async function sendAudio() {
  if (!selectedFiles.audio) {
    showToast("Pilih file audio terlebih dahulu.");
    return;
  }
  if (isSending) return;

  const prompt = document.getElementById("audioPrompt").value.trim();
  const file = selectedFiles.audio;

  haptic(15);
  setBusy(true);
  appendMediaMessage("🎵", "Audio", file.name);
  if (prompt) appendUserMessage(prompt);
  appendTypingIndicator();

  const formData = new FormData();
  formData.append("audio", file);
  if (prompt) formData.append("message", prompt);

  try {
    const res = await fetch("/api/chat/audio", {
      method: "POST",
      body: formData,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Server error");
    chatHistory.push({ role: "user", text: `[Audio: ${file.name}] ${prompt}` });
    chatHistory.push({ role: "model", text: data.result });
    appendBotMessage(data.result);
    clearFile("audio");
    document.getElementById("audioPrompt").value = "";
  } catch (err) {
    appendErrorMessage(err.message || "Gagal menganalisis audio.");
  } finally {
    setBusy(false);
  }
}

function handleAudioKey(e) {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendAudio();
  }
}

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("textInput").focus();

  document.querySelectorAll("textarea").forEach((ta) => autoResize(ta));
});

// ============= BMI Calculator =============

function openBMI() {
  haptic(12);
  const modal = document.getElementById("bmiModal");
  modal.classList.add("open");
  setTimeout(() => document.getElementById("bmiHeight").focus(), 80);
}

function closeBMI() {
  haptic(8);
  document.getElementById("bmiModal").classList.remove("open");
}

function classifyBMI(bmi) {
  if (bmi < 18.5)
    return {
      cls: "is-under",
      label: "Berat badan kurang (underweight)",
      emoji: "📉",
    };
  if (bmi < 25)
    return { cls: "is-normal", label: "Berat badan normal", emoji: "✅" };
  if (bmi < 30)
    return {
      cls: "is-over",
      label: "Berat badan berlebih (overweight)",
      emoji: "⚠️",
    };
  return { cls: "is-obese", label: "Obesitas", emoji: "🚨" };
}

function updateBMI() {
  const heightCm = parseFloat(document.getElementById("bmiHeight").value);
  const weightKg = parseFloat(document.getElementById("bmiWeight").value);
  const resultEl = document.getElementById("bmiResult");
  const valueEl = document.getElementById("bmiValue");
  const catEl = document.getElementById("bmiCategory");
  const askBtn = document.getElementById("bmiAskBtn");

  resultEl.classList.remove("is-under", "is-normal", "is-over", "is-obese");

  if (
    !heightCm ||
    !weightKg ||
    heightCm < 50 ||
    heightCm > 260 ||
    weightKg < 20 ||
    weightKg > 400
  ) {
    valueEl.textContent = "—";
    valueEl.style.color = "";
    catEl.textContent = "Masukkan tinggi & berat";
    askBtn.disabled = true;
    return;
  }

  const heightM = heightCm / 100;
  const bmi = weightKg / (heightM * heightM);
  const { cls, label, emoji } = classifyBMI(bmi);

  valueEl.textContent = bmi.toFixed(1);
  catEl.textContent = `${emoji} ${label}`;
  resultEl.classList.add(cls);
  askBtn.disabled = false;
}

function askBMIAdvice() {
  const heightCm = parseFloat(document.getElementById("bmiHeight").value);
  const weightKg = parseFloat(document.getElementById("bmiWeight").value);
  if (!heightCm || !weightKg) return;

  const bmi = weightKg / (heightCm / 100) ** 2;
  const { label } = classifyBMI(bmi);

  const message = `Saya sudah menghitung BMI saya: tinggi ${heightCm} cm, berat ${weightKg} kg, BMI = ${bmi.toFixed(1)} (${label}). Mohon berikan saran kesehatan, pola makan, dan olahraga yang sesuai untuk kondisi saya. 🩺`;

  closeBMI();
  switchTab("text");
  const input = document.getElementById("textInput");
  input.value = message;
  autoResize(input);
  sendText();
}

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    const modal = document.getElementById("bmiModal");
    if (modal && modal.classList.contains("open")) closeBMI();
  }
});
