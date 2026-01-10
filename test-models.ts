
import { GoogleGenerativeAI } from "@google/generative-ai";
import * as fs from 'fs';
import * as path from 'path';

// Read .env.local manually
const envPath = path.join(process.cwd(), '.env.local');
let apiKey = '';

if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf-8');
    const match = envContent.match(/GOOGLE_GEN_AI_KEY=(.*)/) || envContent.match(/GEMINI_API_KEY=(.*)/);
    if (match) {
        apiKey = match[1].trim();
        // Remove quotes if present
        if (apiKey.startsWith('"') && apiKey.endsWith('"')) apiKey = apiKey.slice(1, -1);
        if (apiKey.startsWith("'") && apiKey.endsWith("'")) apiKey = apiKey.slice(1, -1);
    }
}

if (!apiKey) {
    console.error("No API key found in .env.local");
    process.exit(1);
}

console.log("API Key found (starts with):", apiKey.substring(0, 5));

const genAI = new GoogleGenerativeAI(apiKey);

async function testModel(modelName: string) {
    try {
        console.log(`Testing ${modelName}...`);
        const model = genAI.getGenerativeModel({ model: modelName });
        await model.generateContent("Hello");
        console.log(`SUCCESS: ${modelName} is working.`);
        return true;
    } catch (error: any) {
        console.error(`FAILED: ${modelName} - ${error.message}`);
        return false;
    }
}

async function run() {
    await testModel("gemini-2.5-flash");
    await testModel("gemini-2.0-flash-exp");
    await testModel("gemini-1.5-flash");
    await testModel("gemini-1.5-flash-8b");
}

run();
