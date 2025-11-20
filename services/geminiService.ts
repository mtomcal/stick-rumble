import { GoogleGenAI } from "@google/genai";

// Initialize Gemini Client
// Note: API Key is expected to be in process.env.API_KEY
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
const modelId = 'gemini-2.5-flash';

const SYSTEM_INSTRUCTION = `
You are playing a competitive online stick-figure shooter game (like Stick Arena).
You are a bot.
You need to generate very short, trash-talking chat messages.
Keep it PG-13 but snarky, salty, and competitive.
Use internet gaming slang (n00b, rekt, lag, gg, ez).
Maximum length: 10 words.
`;

export const generateBotTaunt = async (context: string): Promise<string> => {
  try {
    const response = await ai.models.generateContent({
      model: modelId,
      contents: `Context: ${context}. Generate a chat message.`,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        maxOutputTokens: 30,
        temperature: 1.2, // High creativity
      },
    });

    return response.text || "gg lag";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "Are you cheating?"; // Fallback
  }
};

export const generateAnnouncerText = async (wave: number): Promise<string> => {
  try {
    const response = await ai.models.generateContent({
      model: modelId,
      contents: `Wave ${wave} is starting in a survival arena game. Generate a short, hype announcement message. Max 5 words.`,
      config: {
        temperature: 1.0,
      },
    });
    return response.text || `Wave ${wave} Start!`;
  } catch (error) {
    return `Wave ${wave}`;
  }
};
