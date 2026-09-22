import { config } from '../../config/env.js';

export async function generateWithGrok(prompt, jsonSchemaHint) {
  if (!config.llm.grokApiKey || config.llm.grokApiKey.includes('your_grok_api_key')) {
    throw new Error('Grok API Key is not configured or is a placeholder.');
  }

  console.log('[LLM Engine] Attempting fallback generation with xAI (Grok)...');

  const systemMessage = `You are an expert educational quiz generator. 
Generate a high-quality quiz based on the user text. 
Return ONLY valid JSON matching this structure exactly (no markdown block wrappers or extra text):
${JSON.stringify(jsonSchemaHint, null, 2)}`;

  const url = 'https://api.x.ai/v1/chat/completions';

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.llm.grokApiKey}`
    },
    body: JSON.stringify({
      model: 'grok-beta',
      messages: [
        { role: 'system', content: systemMessage },
        { role: 'user', content: prompt }
      ],
      temperature: 0.5,
      response_format: { type: 'json_object' }
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`xAI Grok API error status ${response.status}: ${errText}`);
  }

  const data = await response.json();
  const rawText = data.choices?.[0]?.message?.content;

  if (!rawText) {
    throw new Error('xAI Grok returned empty choices response');
  }

  return rawText;
}
