import "dotenv/config";
import express from "express";
import cors from "cors";
import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";
import { GoogleGenAI } from "@google/genai";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const upload = multer({ limits: { fileSize: 20 * 1024 * 1024 } }); // 20MB limit

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

const GEMINI_MODEL = "gemini-2.5-flash";

const SYSTEM_INSTRUCTION = `Kamu adalah HealthBot, asisten kesehatan AI yang ramah, empatik, dan berpengetahuan luas. 
Kamu membantu pengguna memahami informasi kesehatan, gejala umum, saran gaya hidup sehat, nutrisi, olahraga, dan kesehatan mental.

PEDOMAN PENTING:
- Selalu berikan informasi yang akurat dan berbasis bukti ilmiah
- Gunakan bahasa yang mudah dipahami, hangat, dan empatik
- Untuk kondisi serius atau darurat medis, SELALU sarankan untuk segera berkonsultasi dengan dokter atau pergi ke IGD
- Jangan pernah mendiagnosis penyakit secara pasti - kamu hanya memberikan informasi umum
- Sertakan disclaimer medis ketika relevan
- Jawab dalam bahasa yang sama dengan pertanyaan pengguna (Indonesia atau Inggris)
- Gunakan emoji yang relevan untuk membuat percakapan lebih menyenangkan
- Format jawaban dengan rapi menggunakan poin-poin jika diperlukan
- Tunjukkan kepedulian dan empati terhadap kondisi pengguna

Topik yang bisa kamu bantu:
- Informasi gejala umum
- Saran gaya hidup sehat
- Nutrisi dan diet
- Olahraga dan kebugaran
- Kesehatan mental dan manajemen stres
- Pencegahan penyakit
- Pertolongan pertama dasar
- Analisis gambar medis umum (foto kulit, dll) - dengan disclaimer
- Membaca dan menjelaskan dokumen kesehatan
- Transkripsi dan analisis audio terkait kesehatan`;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", message: "HealthBot API is running 🩺" });
});

app.post("/api/chat/text", async (req, res) => {
  const { message, history = [] } = req.body;

  if (!message || !message.trim()) {
    return res.status(400).json({ error: "Pesan tidak boleh kosong." });
  }

  try {
    const contents = [
      ...history.map(({ role, text }) => ({
        role,
        parts: [{ text }],
      })),
      {
        role: "user",
        parts: [{ text: message }],
      },
    ];

    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        temperature: 0.7,
        topP: 0.9,
        topK: 40,
      },
    });

    res.status(200).json({ result: response.text });
  } catch (error) {
    console.error("Text chat error:", error);
    res.status(500).json({ error: "Gagal mendapatkan respons. Coba lagi." });
  }
});

app.post("/api/chat/image", upload.single("image"), async (req, res) => {
  const {
    message = "Tolong analisis gambar ini dari perspektif kesehatan dan berikan informasi yang relevan.",
  } = req.body;

  if (!req.file) {
    return res.status(400).json({ error: "Tidak ada gambar yang diunggah." });
  }

  const base64Image = req.file.buffer.toString("base64");

  try {
    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: [
        {
          role: "user",
          parts: [
            { text: message },
            { inlineData: { data: base64Image, mimeType: req.file.mimetype } },
          ],
        },
      ],
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        temperature: 0.7,
        topP: 0.9,
      },
    });

    res.status(200).json({ result: response.text });
  } catch (error) {
    console.error("Image chat error:", error);
    res.status(500).json({ error: "Gagal menganalisis gambar. Coba lagi." });
  }
});

app.post("/api/chat/document", upload.single("document"), async (req, res) => {
  const {
    message = "Tolong baca dan jelaskan dokumen kesehatan ini dengan bahasa yang mudah dipahami. Berikan ringkasan poin-poin penting.",
  } = req.body;

  if (!req.file) {
    return res.status(400).json({ error: "Tidak ada dokumen yang diunggah." });
  }

  const base64Doc = req.file.buffer.toString("base64");

  try {
    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: [
        {
          role: "user",
          parts: [
            { text: message },
            { inlineData: { data: base64Doc, mimeType: req.file.mimetype } },
          ],
        },
      ],
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        temperature: 0.5,
        topP: 0.85,
      },
    });

    res.status(200).json({ result: response.text });
  } catch (error) {
    console.error("Document chat error:", error);
    res.status(500).json({ error: "Gagal membaca dokumen. Coba lagi." });
  }
});

app.post("/api/chat/audio", upload.single("audio"), async (req, res) => {
  const {
    message = "Tolong transkripsi audio ini, kemudian jika berkaitan dengan kesehatan, berikan informasi dan saran yang relevan.",
  } = req.body;

  if (!req.file) {
    return res
      .status(400)
      .json({ error: "Tidak ada file audio yang diunggah." });
  }

  const base64Audio = req.file.buffer.toString("base64");

  try {
    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: [
        {
          role: "user",
          parts: [
            { text: message },
            { inlineData: { data: base64Audio, mimeType: req.file.mimetype } },
          ],
        },
      ],
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        temperature: 0.6,
        topP: 0.9,
      },
    });

    res.status(200).json({ result: response.text });
  } catch (error) {
    console.error("Audio chat error:", error);
    res.status(500).json({ error: "Gagal menganalisis audio. Coba lagi." });
  }
});

// Generate follow-up suggestions based on bot response
app.post("/api/chat/suggestions", async (req, res) => {
  const { context } = req.body;

  if (!context || !context.trim()) {
    return res.status(400).json({ error: "Context tidak boleh kosong." });
  }

  try {
    const prompt = `Berdasarkan respons berikut dari HealthBot, berikan 3 saran pertanyaan lanjutan yang relevan untuk pengguna. Format jawaban: array JSON dengan key "suggestions" berisi 3 string pertanyaan. Setiap pertanyaan harus pendek (maksimal 50 karakter), praktis, dan langsung berkaitan dengan topik yang dibahas.

Respons HealthBot:
${context.slice(0, 800)}${context.length > 800 ? "..." : ""}

Contoh format jawaban:
{"suggestions": ["Apa penyebabnya?", "Bagaimana mencegahnya?", "Obat apa yang cocok?"]}`;

    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: {
        temperature: 0.7,
        topP: 0.9,
        responseMimeType: "application/json",
      },
    });

    let suggestions = [];
    try {
      const parsed = JSON.parse(response.text);
      suggestions = parsed.suggestions || [];
    } catch {
      // Extract suggestions from text if JSON parsing fails
    const match = response.text.match(/\[.*\]/s);
    if (match) {
      try {
        suggestions = JSON.parse(match[0]);
      } catch {
        // Parse from lines if JSON fails
        suggestions = response.text
            .split(/\n|[-•*]/)
            .map((s) => s.trim().replace(/^\d+[.)]\s*/, ""))
            .filter((s) => s.length > 0 && s.length < 60)
            .slice(0, 3);
        }
      }
    }

    // Always return exactly 3 suggestions
    if (!Array.isArray(suggestions) || suggestions.length < 3) {
      suggestions = [
        "Apa yang harus saya lakukan selanjutnya?",
        "Apakah ada efek samping yang perlu diwaspadai?",
        "Kapan saya harus ke dokter?",
      ];
    }

    res.status(200).json({ suggestions: suggestions.slice(0, 3) });
  } catch (error) {
    console.error("Suggestions error:", error);
    res.status(500).json({ suggestions: [] });
  }
});

app.get(/.*/, (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`HealthBot server running on http://localhost:${PORT}`);
});
