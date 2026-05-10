let chatHistory = []; // [{role:'user'|'model', text:'...', ts:number, kind?:'media', mediaIcon?, mediaLabel?, mediaName?, prompt?}]
let isSending = false;
let selectedAttachment = null; // { type: 'image'|'document'|'audio', file: File, previewUrl?: string }

const STORAGE_KEY = "healthbot:chat:v1";
const MAX_PERSISTED_MESSAGES = 100;

const ATTACH_META = {
  image: {
    label: "Gambar",
    icon: "🖼️",
    inputId: "imageInput",
    endpoint: "/api/chat/image",
    field: "image",
    errorMsg: "Gagal menganalisis gambar.",
    placeholder: "Tambahkan keterangan untuk gambar (opsional)...",
  },
  document: {
    label: "Dokumen",
    icon: "📄",
    inputId: "docInput",
    endpoint: "/api/chat/document",
    field: "document",
    errorMsg: "Gagal membaca dokumen.",
    placeholder: "Tambahkan pertanyaan tentang dokumen (opsional)...",
  },
  audio: {
    label: "Audio",
    icon: "🎵",
    inputId: "audioInput",
    endpoint: "/api/chat/audio",
    field: "audio",
    errorMsg: "Gagal menganalisis audio.",
    placeholder: "Tambahkan pertanyaan tentang audio (opsional)...",
  },
};
const DEFAULT_PLACEHOLDER = "Ketik pertanyaan kesehatan Anda...";

function saveHistory() {
  try {
    const trimmed = chatHistory.slice(-MAX_PERSISTED_MESSAGES);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch (_) {
    /* localStorage unavailable or quota exceeded — silent fail */
  }
}

function loadHistory() {
  let parsed;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    parsed = JSON.parse(raw);
  } catch (_) {
    return;
  }
  if (!Array.isArray(parsed) || parsed.length === 0) return;

  chatHistory = parsed.filter(
    (e) =>
      e &&
      (e.role === "user" || e.role === "model") &&
      typeof e.text === "string",
  );
  if (chatHistory.length === 0) return;

  hideWelcome();
  chatHistory.forEach(renderHistoryEntry);
  showToast(
    `${chatHistory.length} pesan dipulihkan dari sesi sebelumnya`,
    "info",
  );
}

function renderHistoryEntry(entry) {
  if (entry.role === "user") {
    if (entry.kind === "media") {
      appendMediaMessage(
        entry.mediaIcon || "📎",
        entry.mediaLabel || "File",
        entry.mediaName || "",
      );
      if (entry.prompt) appendUserMessage(entry.prompt);
    } else {
      appendUserMessage(entry.text);
    }
  } else if (entry.role === "model") {
    appendBotMessage(entry.text, entry.ts, { silent: true });
  }
}

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
  const sendBtn = document.getElementById("sendBtn");
  const attachBtn = document.getElementById("attachToggle");
  if (sendBtn) sendBtn.disabled = busy;
  if (attachBtn) attachBtn.disabled = busy;
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

function appendBotMessage(text, ts, opts = {}) {
  if (!opts.silent) {
    removeTypingIndicator();
    haptic(12);
  }
  const container = document.getElementById("messagesContainer");
  const div = document.createElement("div");
  div.className = "msg-enter flex justify-start";

  const parsed = marked.parse(text || "");
  const timeText = new Date(ts || Date.now()).toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
  });

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
              <span class="text-slate-700 text-xs">${timeText}</span>
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
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (_) {
    /* noop */
  }
  document.getElementById("messagesContainer").innerHTML = "";
  document.getElementById("welcomeScreen").style.display = "";
  const composer = document.getElementById("composerInput");
  composer.value = "";
  autoResize(composer);
  clearAttachment();
  closeAttachMenu();
}

function askTopic(msg) {
  closeAttachMenu();
  clearAttachment();
  const input = document.getElementById("composerInput");
  input.value = msg;
  autoResize(input);
  sendText();
}

// ============= Composer / Attachments =============

function toggleAttachMenu(e) {
  if (e) e.stopPropagation();
  if (isSending) return;
  haptic(8);
  const menu = document.getElementById("attachMenu");
  const btn = document.getElementById("attachToggle");
  const isOpen = !menu.classList.contains("hidden");
  if (isOpen) {
    closeAttachMenu();
  } else {
    menu.classList.remove("hidden");
    menu.setAttribute("aria-hidden", "false");
    btn.classList.add("open");
  }
}

function closeAttachMenu() {
  const menu = document.getElementById("attachMenu");
  const btn = document.getElementById("attachToggle");
  if (!menu) return;
  menu.classList.add("hidden");
  menu.setAttribute("aria-hidden", "true");
  if (btn) btn.classList.remove("open");
}

function pickAttachment(type) {
  closeAttachMenu();
  const meta = ATTACH_META[type];
  if (!meta) return;
  document.getElementById(meta.inputId).click();
}

function handleFileSelect(event, type) {
  const file = event.target.files[0];
  if (file) setAttachment(type, file);
  // Reset so picking the same file again still triggers onchange
  event.target.value = "";
}

function setAttachment(type, file) {
  const meta = ATTACH_META[type];
  if (!meta) return;

  if (file.size > 20 * 1024 * 1024) {
    showToast("Ukuran file maksimal 20MB.");
    return;
  }

  if (selectedAttachment?.previewUrl) {
    URL.revokeObjectURL(selectedAttachment.previewUrl);
  }

  let previewUrl = null;
  if (type === "image" || type === "audio") {
    previewUrl = URL.createObjectURL(file);
  }
  selectedAttachment = { type, file, previewUrl };

  renderAttachmentPreview();

  const composer = document.getElementById("composerInput");
  composer.placeholder = meta.placeholder;
  composer.focus();
  haptic(10);
}

function clearAttachment() {
  if (!selectedAttachment) return;
  if (selectedAttachment.previewUrl) {
    URL.revokeObjectURL(selectedAttachment.previewUrl);
  }
  selectedAttachment = null;
  ["imageInput", "docInput", "audioInput"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });
  renderAttachmentPreview();
  document.getElementById("composerInput").placeholder = DEFAULT_PLACEHOLDER;
}

function renderAttachmentPreview() {
  const el = document.getElementById("attachmentPreview");
  if (!el) return;
  if (!selectedAttachment) {
    el.classList.add("hidden");
    el.innerHTML = "";
    return;
  }
  const { type, file, previewUrl } = selectedAttachment;
  const meta = ATTACH_META[type];

  let thumb;
  if (type === "image" && previewUrl) {
    thumb = `<img src="${previewUrl}" class="attach-chip-thumb" alt=""/>`;
  } else {
    thumb = `<div class="attach-chip-thumb">${meta.icon}</div>`;
  }

  const sizeMb = (file.size / 1024 / 1024).toFixed(2);
  el.classList.remove("hidden");
  el.innerHTML = `
    <div class="attach-chip">
      ${thumb}
      <div class="attach-chip-meta">
        <p class="attach-chip-name" title="${escapeHtml(file.name)}">${escapeHtml(file.name)}</p>
        <p class="attach-chip-size">${meta.label} • ${sizeMb} MB</p>
      </div>
      <button type="button" class="attach-chip-remove" onclick="clearAttachment()" aria-label="Hapus lampiran" title="Hapus">
        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
      </button>
    </div>`;
}

function handleComposerKey(e) {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
}

async function sendMessage() {
  if (isSending) return;
  if (selectedAttachment) {
    await sendWithAttachment();
  } else {
    await sendText();
  }
}

async function sendText() {
  const input = document.getElementById("composerInput");
  const message = input.value.trim();
  if (!message || isSending) return;

  haptic(15);
  input.value = "";
  autoResize(input);
  setBusy(true);
  appendUserMessage(message);
  appendTypingIndicator();

  chatHistory.push({ role: "user", text: message, ts: Date.now() });
  saveHistory();

  try {
    const res = await fetch("/api/chat/text", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, history: chatHistory.slice(0, -1) }),
    });
    const data = await res.json();

    if (!res.ok) throw new Error(data.error || "Server error");

    chatHistory.push({ role: "model", text: data.result, ts: Date.now() });
    saveHistory();
    appendBotMessage(data.result);
  } catch (err) {
    chatHistory.pop();
    saveHistory();
    appendErrorMessage(err.message || "Terjadi kesalahan. Coba lagi.");
  } finally {
    setBusy(false);
  }
}

async function sendWithAttachment() {
  if (!selectedAttachment || isSending) return;
  const { type, file } = selectedAttachment;
  const meta = ATTACH_META[type];

  const input = document.getElementById("composerInput");
  const prompt = input.value.trim();
  const fileName = file.name;

  haptic(15);
  setBusy(true);
  appendMediaMessage(meta.icon, meta.label, fileName);
  if (prompt) appendUserMessage(prompt);
  appendTypingIndicator();

  const formData = new FormData();
  formData.append(meta.field, file);
  if (prompt) formData.append("message", prompt);

  // Snapshot to allow restore on error
  const restore = selectedAttachment;
  input.value = "";
  autoResize(input);
  selectedAttachment = null;
  renderAttachmentPreview();
  input.placeholder = DEFAULT_PLACEHOLDER;

  try {
    const res = await fetch(meta.endpoint, { method: "POST", body: formData });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Server error");

    chatHistory.push({
      role: "user",
      text: `[${meta.label}: ${fileName}] ${prompt}`,
      kind: "media",
      mediaIcon: meta.icon,
      mediaLabel: meta.label,
      mediaName: fileName,
      prompt,
      ts: Date.now(),
    });
    chatHistory.push({ role: "model", text: data.result, ts: Date.now() });
    saveHistory();
    appendBotMessage(data.result);

    // success — release any preview URL we held
    if (restore.previewUrl) URL.revokeObjectURL(restore.previewUrl);
    ["imageInput", "docInput", "audioInput"].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.value = "";
    });
  } catch (err) {
    appendErrorMessage(err.message || meta.errorMsg);
    // Restore attachment so user can retry without re-picking
    selectedAttachment = restore;
    renderAttachmentPreview();
    input.placeholder = meta.placeholder;
  } finally {
    setBusy(false);
  }
}

// ============= Drag & Drop on chat area =============

function detectAttachmentType(file) {
  if (!file) return null;
  const t = file.type || "";
  if (t.startsWith("image/")) return "image";
  if (t.startsWith("audio/")) return "audio";
  if (
    t === "application/pdf" ||
    t === "text/plain" ||
    /\.(pdf|txt|doc|docx)$/i.test(file.name)
  ) {
    return "document";
  }
  // Fallback on extension
  if (/\.(jpe?g|png|gif|webp|bmp|heic|heif)$/i.test(file.name)) return "image";
  if (/\.(mp3|wav|ogg|m4a|aac|flac)$/i.test(file.name)) return "audio";
  return null;
}

function setupDragAndDrop() {
  const main = document.querySelector("main");
  if (!main) return;

  // Position-relative wrapper for overlay
  main.style.position = main.style.position || "relative";

  const overlay = document.createElement("div");
  overlay.className = "drop-overlay";
  overlay.innerHTML = `
    <div class="text-center">
      <div class="text-4xl mb-2">📎</div>
      <p class="text-sm font-medium text-jade-300">Lepaskan file di sini untuk dilampirkan</p>
      <p class="text-xs text-slate-500 mt-1">Gambar, dokumen, atau audio (maks 20MB)</p>
    </div>`;
  main.appendChild(overlay);

  let dragDepth = 0;
  const isFileDrag = (e) =>
    Array.from(e.dataTransfer?.types || []).includes("Files");

  main.addEventListener("dragenter", (e) => {
    if (!isFileDrag(e)) return;
    e.preventDefault();
    dragDepth++;
    overlay.classList.add("show");
  });
  main.addEventListener("dragover", (e) => {
    if (!isFileDrag(e)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  });
  main.addEventListener("dragleave", (e) => {
    if (!isFileDrag(e)) return;
    dragDepth = Math.max(0, dragDepth - 1);
    if (dragDepth === 0) overlay.classList.remove("show");
  });
  main.addEventListener("drop", (e) => {
    if (!isFileDrag(e)) return;
    e.preventDefault();
    dragDepth = 0;
    overlay.classList.remove("show");
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    const type = detectAttachmentType(file);
    if (!type) {
      showToast("Tipe file tidak didukung.");
      return;
    }
    setAttachment(type, file);
  });
}

// ============= Init =============

document.addEventListener("DOMContentLoaded", () => {
  loadHistory();
  document.getElementById("composerInput").focus();
  document.querySelectorAll("textarea").forEach((ta) => autoResize(ta));
  setupDragAndDrop();
});

// Close attach menu on outside click
document.addEventListener("click", (e) => {
  const menu = document.getElementById("attachMenu");
  if (!menu || menu.classList.contains("hidden")) return;
  const toggle = document.getElementById("attachToggle");
  if (menu.contains(e.target) || toggle?.contains(e.target)) return;
  closeAttachMenu();
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
  clearAttachment();
  const input = document.getElementById("composerInput");
  input.value = message;
  autoResize(input);
  sendText();
}

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    const modal = document.getElementById("bmiModal");
    if (modal && modal.classList.contains("open")) {
      closeBMI();
      return;
    }
    const menu = document.getElementById("attachMenu");
    if (menu && !menu.classList.contains("hidden")) {
      closeAttachMenu();
    }
  }
});
