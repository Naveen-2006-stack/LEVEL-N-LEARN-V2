import Groq from 'groq-sdk';
import { config } from '../../config/env.js';

export async function generateWithGroq(prompt, jsonSchemaHint) {
  if (!config.llm.groqApiKey || config.llm.groqApiKey.includes('your_groq_api_key')) {
    throw new Error('Groq API Key is not configured or is a placeholder.');
  }

  const groq = new Groq({ apiKey: config.llm.groqApiKey });

  const systemMessage = `You are an expert educational quiz generator. 
Generate a high-quality quiz based on the user text. 
Return ONLY valid JSON matching this structure exactly (no markdown block wrappers or extra text):
${JSON.stringify(jsonSchemaHint, null, 2)}`;

  console.log('[LLM Engine] Attempting generation with Groq (openai/gpt-oss-120b)...');

  const completion = await groq.chat.completions.create({
    messages: [
      { role: 'system', content: systemMessage },
      { role: 'user', content: prompt },
    ],
    model: 'openai/gpt-oss-120b',
    temperature: 0.5,
    response_format: { type: 'json_object' },
  });

  const rawContent = completion.choices[0]?.message?.content;
  if (!rawContent) {
    throw new Error('Groq returned empty response body');
  }

  return rawContent;
}
