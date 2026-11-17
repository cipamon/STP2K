import { GoogleGenAI, Type } from "@google/genai";
import { AIAnalysisResult, ViolationCategory } from "../types";

const getAiClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    console.error("API Key not found");
    throw new Error("API Key is missing. Please check your environment configuration.");
  }
  return new GoogleGenAI({ apiKey });
};

export const analyzeViolationText = async (description: string): Promise<AIAnalysisResult> => {
  try {
    const ai = getAiClient();
    
    const prompt = `
      Anda adalah asisten AI untuk sistem manajemen kedisiplinan sekolah.
      Tugas anda adalah menganalisis deskripsi kejadian berikut dan menentukan kategori pelanggaran (Ringan, Sedang, Berat) atau Prestasi.
      Berikan juga saran poin (angka positif untuk pelanggaran, negatif untuk prestasi jika deskripsi menyiratkan hal positif) dan ringkasan singkat.
      
      Deskripsi: "${description}"
      
      Kategori yang valid: Ringan, Sedang, Berat, Prestasi.
      Contoh Poin: Ringan (2-10), Sedang (11-25), Berat (26-100), Prestasi (-10 sampai -50).
    `;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            category: { type: Type.STRING, enum: [ViolationCategory.RINGAN, ViolationCategory.SEDANG, ViolationCategory.BERAT, ViolationCategory.PRESTASI] },
            suggestedPoints: { type: Type.INTEGER },
            summary: { type: Type.STRING }
          },
          required: ["category", "suggestedPoints", "summary"]
        }
      }
    });

    const resultText = response.text;
    if (!resultText) throw new Error("No response from AI");

    const result = JSON.parse(resultText) as AIAnalysisResult;
    return result;

  } catch (error) {
    console.error("Error analyzing violation:", error);
    // Fallback if AI fails
    return {
      category: ViolationCategory.SEDANG,
      suggestedPoints: 10,
      summary: "Analisis gagal, gunakan manual input."
    };
  }
};
