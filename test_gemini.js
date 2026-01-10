const { GoogleGenerativeAI } = require("@google/generative-ai");
require('dotenv').config({ path: '.env.local' });

async function testModel() {
    const apiKey = process.env.GOOGLE_GEN_AI_KEY || process.env.GEMINI_API_KEY || process.env.AI_API_KEY_1;
    if (!apiKey) {
        console.error("No API key found in .env.local");
        return;
    }

    console.log(`Testing with key: ${apiKey.substring(0, 5)}...`);
    const modelName = "gemini-2.5-flash"; // User requested model
    console.log(`Model: ${modelName}`);

    try {
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: modelName });
        const result = await model.generateContent("Hello, are you working?");
        const response = await result.response;
        console.log("Success! Response:", response.text());
    } catch (error) {
        console.error("Error testing model:", error.message);
    }
}

testModel();
