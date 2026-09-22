import { generateWithGroq } from './groqProvider.js';
import { generateWithGemini } from './geminiProvider.js';
import { generateWithGrok } from './grokProvider.js';
import { quizService } from '../quizService.js';

const QUIZ_SCHEMA_TEMPLATE = {
  title: "Quiz Title",
  description: "Short description of the generated quiz topic",
  questions: [
    {
      question_text: "Clear, concise question statement",
      options: ["Option A", "Option B", "Option C", "Option D"],
      correct_option: 0,
      difficulty_tier: "medium"
    }
  ]
};

/**
 * Sanitizes and validates the raw JSON response from an LLM.
 */
function sanitizeAndParseQuiz(rawText) {
  if (!rawText || typeof rawText !== 'string') {
    throw new Error('LLM returned an empty or non-text response');
  }

  let cleaned = rawText.trim();
  // Strip markdown code fences if present
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.replace(/^```json\s*/i, '').replace(/\s*```$/i, '');
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```\s*/, '').replace(/\s*```$/, '');
  }
  cleaned = cleaned.trim();

  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch (e) {
    // Model may have wrapped the JSON in prose ("Here is your quiz: {...} Hope that helps!").
    // Fall back to extracting the outermost {...} span before giving up.
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start === -1 || end === -1 || end <= start) {
      throw new Error(`LLM response was not valid JSON: ${e.message}`);
    }
    try {
      parsed = JSON.parse(cleaned.slice(start, end + 1));
    } catch (e2) {
      throw new Error(`LLM response was not valid JSON: ${e2.message}`);
    }
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Generated quiz response was not a JSON object');
  }

  if (!parsed.title || typeof parsed.title !== 'string') {
    throw new Error('Generated quiz is missing a valid title');
  }

  if (!Array.isArray(parsed.questions) || parsed.questions.length === 0) {
    throw new Error('Generated quiz contains no valid questions array');
  }

  // Sanitize each question. Any single malformed question fails the WHOLE
  // generation (no partially-corrupted quiz is ever persisted).
  parsed.questions = parsed.questions.map((q, idx) => {
    if (!q || typeof q !== 'object') {
      throw new Error(`Question at index ${idx} is not a valid object`);
    }

    if (!q.question_text || typeof q.question_text !== 'string' || !q.question_text.trim()) {
      throw new Error(`Question at index ${idx} is missing question_text`);
    }

    if (!Array.isArray(q.options) || q.options.length < 2) {
      throw new Error(`Question at index ${idx} must have at least 2 options`);
    }
    if (q.options.some(opt => opt === null || opt === undefined || String(opt).trim() === '')) {
      throw new Error(`Question at index ${idx} contains an empty option`);
    }

    const correctIndex = Number(q.correct_option);
    if (!Number.isInteger(correctIndex) || correctIndex < 0 || correctIndex >= q.options.length) {
      throw new Error(`Question at index ${idx} has invalid correct_option index`);
    }

    const validTiers = ['easy', 'medium', 'hard'];
    return {
      question_text: q.question_text.trim(),
      options: q.options.map(opt => String(opt).trim()),
      correct_option: correctIndex,
      difficulty_tier: validTiers.includes(q.difficulty_tier) ? q.difficulty_tier : 'medium'
    };
  });

  return parsed;
}

const PROVIDER_TIMEOUT_MS = 20000;

/**
 * Races a provider call against a hard timeout so a hung provider can never
 * stall the whole request indefinitely -- it must cascade to the next provider.
 */
function withTimeout(promise, ms, label) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

/**
 * Executes cascading Multi-LLM generation (Groq -> Gemini -> Grok).
 * Sanitizes output and persists directly into Supabase.
 */
export async function generateAndPersistQuiz({ creatorId, lessonNotes, topic, numQuestions = 5 }) {
  const promptText = `Topic: ${topic || 'General Knowledge'}\n` +
    `Number of Questions Required: ${numQuestions}\n` +
    `Lesson Notes/Source Text:\n${lessonNotes}\n\n` +
    `Generate a set of multiple-choice questions based on the provided topic and notes.`;

  let rawOutput = null;
  let providerUsed = null;
  const errors = [];

  // Stage 1: Groq (Llama 3)
  try {
    rawOutput = await withTimeout(generateWithGroq(promptText, QUIZ_SCHEMA_TEMPLATE), PROVIDER_TIMEOUT_MS, 'Groq');
    providerUsed = 'Groq (openai/gpt-oss-120b)';
  } catch (groqErr) {
    console.warn(`[LLM Engine] Groq provider failed: ${groqErr.message}. Cascading to Gemini...`);
    errors.push(`Groq: ${groqErr.message}`);
  }

  // Stage 2: Google Gemini Fallback
  if (!rawOutput) {
    try {
      rawOutput = await withTimeout(generateWithGemini(promptText, QUIZ_SCHEMA_TEMPLATE), PROVIDER_TIMEOUT_MS, 'Gemini');
      providerUsed = 'Google Gemini';
    } catch (geminiErr) {
      console.warn(`[LLM Engine] Gemini provider failed: ${geminiErr.message}. Cascading to xAI Grok...`);
      errors.push(`Gemini: ${geminiErr.message}`);
    }
  }

  // Stage 3: xAI (Grok) Fallback
  if (!rawOutput) {
    try {
      rawOutput = await withTimeout(generateWithGrok(promptText, QUIZ_SCHEMA_TEMPLATE), PROVIDER_TIMEOUT_MS, 'Grok');
      providerUsed = 'xAI Grok';
    } catch (grokErr) {
      console.error(`[LLM Engine] All LLM providers failed. Grok error: ${grokErr.message}`);
      errors.push(`Grok: ${grokErr.message}`);
      throw new Error(`Multi-LLM Quiz Generation Failed across all providers. Errors: ${errors.join(' | ')}`);
    }
  }

  console.log(`[LLM Engine] Successfully generated raw quiz response using ${providerUsed}`);

  // Sanitize and Parse Output. Any failure here throws BEFORE any database
  // write happens, so malformed LLM output can never reach persistence.
  const structuredQuiz = sanitizeAndParseQuiz(rawOutput);

  // Immediately Insert into Supabase Database
  let createdQuiz;
  try {
    createdQuiz = await quizService.createQuiz({
      creatorId,
      title: structuredQuiz.title,
      description: structuredQuiz.description || `AI-Generated quiz via ${providerUsed}`,
      questions: structuredQuiz.questions
    });
  } catch (dbErr) {
    throw new Error(`Quiz was generated and validated, but failed to persist to the database: ${dbErr.message}`);
  }

  return {
    quiz: createdQuiz,
    providerUsed,
    questionCount: structuredQuiz.questions.length
  };
}
