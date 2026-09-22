import { config } from '../../config/env.js';

export async function generateWithGemini(prompt, jsonSchemaHint) {
  if (!config.llm.geminiApiKey || config.llm.geminiApiKey.includes('your_gemini_api_key')) {
    throw new Error('Gemini API Key is not configured or is a placeholder.');
  }

  console.log('[LLM Engine] Attempting fallback generation with Google Gemini...');

  const systemPrompt = `You are an expert educational quiz generator. 
Generate a high-quality quiz based on the user text. 
Return ONLY valid JSON matching this structure exactly (no markdown formatting, no text outside JSON):
${JSON.stringify(jsonSchemaHint, null, 2)}`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${config.llm.geminiApiKey}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      contents: [
        {
          role: 'user',
          parts: [
            { text: `${systemPrompt}\n\nUser Input/Notes:\n${prompt}` }
          ]
        }
      ],
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.4
      }
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Gemini API error status ${response.status}: ${errText}`);
  }

  const data = await response.json();
  const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!rawText) {
    throw new Error('Gemini returned empty candidate text response');
  }

  return rawText;
}
