import { GoogleGenerativeAI } from "@google/generative-ai";

export const getGeminiApiKeys = () => {
    const keys = [
        process.env.GEMINI_SECRET_KEY_1,
        process.env.GEMINI_SECRET_KEY_2,
        process.env.GEMINI_SECRET_KEY_3,
        process.env.GEMINI_SECRET_KEY_4,
        process.env.GEMINI_SECRET_KEY_5,
        process.env.GEMINI_API_KEY
    ].filter((key): key is string => !!key && key.length > 0);

    return [...new Set(keys)];
};

export const getGeminiModel = (modelName: string = "gemini-2.5-flash") => {
    const keys = getGeminiApiKeys();
    if (keys.length === 0) {
        throw new Error("No Gemini API keys found in environment variables");
    }

    // Simple random rotation to distribute load
    const randomKey = keys[Math.floor(Math.random() * keys.length)];
    const genAI = new GoogleGenerativeAI(randomKey);

    return genAI.getGenerativeModel({ model: modelName });
};
