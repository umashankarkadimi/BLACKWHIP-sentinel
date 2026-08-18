const fs = require('fs');
let ai = fs.readFileSync('backend/ai.ts', 'utf8');

ai = ai.replace(/const ai = new GoogleGenAI\(\{ apiKey: process\.env\.GEMINI_API_KEY \}\);/g, `const getAI = () => {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY is not configured.");
  return new GoogleGenAI({ apiKey: key });
};`);

ai = ai.replace(/const response = await ai\.models\.generateContent\(\{/g, `const response = await getAI().models.generateContent({`);

fs.writeFileSync('backend/ai.ts', ai);
