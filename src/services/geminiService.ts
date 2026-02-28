import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export async function translateMessage(text: string, targetLang: string) {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Translate the following text to ${targetLang}. Only return the translated text: "${text}"`,
    });
    return response.text || text;
  } catch (error) {
    console.error("Translation error:", error);
    return text;
  }
}

export async function getAIChatbotResponse(userMessage: string) {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: userMessage,
      config: {
        systemInstruction: "You are Wicara AI, a helpful customer support assistant for the Wicara messaging app. Answer questions about the app's features: chat, calls, security, and nearby search. Keep responses concise and friendly.",
      }
    });
    return response.text || "I'm sorry, I couldn't process that.";
  } catch (error) {
    console.error("AI Chatbot error:", error);
    return "I'm having trouble connecting to my brain right now.";
  }
}
