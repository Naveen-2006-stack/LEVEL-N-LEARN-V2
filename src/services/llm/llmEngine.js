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
  let cleaned = rawText.trim();
  // Strip markdown code fences if present
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.replace(/^```json\s*/i, '').replace(/\s*```$/i, '');
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```\s*/, '').replace(/\s*```$/, '');
  }

  const parsed = JSON.parse(cleaned);

  if (!parsed.title || typeof parsed.title !== 'string') {
    throw new Error('Generated quiz is missing a valid title');
  }

  if (!Array.isArray(parsed.questions) || parsed.questions.length === 0) {
    throw new Error('Generated quiz contains no valid questions array');
  }

  // Sanitize each question
  parsed.questions = parsed.questions.map((q, idx) => {
    if (!q.question_text || typeof q.question_text !== 'string') {
      throw new Error(`Question at index ${idx} is missing question_text`);
    }

    if (!Array.isArray(q.options) || q.options.length < 2) {
      throw new Error(`Question at index ${idx} must have at least 2 options`);
    }

    const correctIndex = Number(q.correct_option);
    if (isNaN(correctIndex) || correctIndex < 0 || correctIndex >= q.options.length) {
      throw new Error(`Question at index ${idx} has invalid correct_option index`);
    }

    return {
      question_text: q.question_text.trim(),
      options: q.options.map(opt => String(opt).trim()),
      correct_option: correctIndex,
      difficulty_tier: ['easy', 'medium', 'hard'].includes(q.difficulty_tier)
        ? q.difficulty_tier
        : 'medium'
    };
  });

  return parsed;
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
    rawOutput = await generateWithGroq(promptText, QUIZ_SCHEMA_TEMPLATE);
    providerUsed = 'Groq (Llama-3.3-70b)';
  } catch (groqErr) {
    console.warn(`[LLM Engine] Groq provider failed: ${groqErr.message}. Cascading to Gemini...`);
    errors.push(`Groq: ${groqErr.message}`);
  }

  // Stage 2: Google Gemini Fallback
  if (!rawOutput) {
    try {
      rawOutput = await generateWithGemini(promptText, QUIZ_SCHEMA_TEMPLATE);
      providerUsed = 'Google Gemini';
    } catch (geminiErr) {
      console.warn(`[LLM Engine] Gemini provider failed: ${geminiErr.message}. Cascading to xAI Grok...`);
      errors.push(`Gemini: ${geminiErr.message}`);
    }
  }

  // Stage 3: xAI (Grok) Fallback
  if (!rawOutput) {
    try {
      rawOutput = await generateWithGrok(promptText, QUIZ_SCHEMA_TEMPLATE);
      providerUsed = 'xAI Grok';
    } catch (grokErr) {
      console.error(`[LLM Engine] All LLM providers failed. Grok error: ${grokErr.message}`);
      errors.push(`Grok: ${grokErr.message}`);
      throw new Error(`Multi-LLM Quiz Generation Failed across all providers. Errors: ${errors.join(' | ')}`);
    }
  }

  console.log(`[LLM Engine] Successfully generated raw quiz response using ${providerUsed}`);

  // Sanitize and Parse Output
  const structuredQuiz = sanitizeAndParseQuiz(rawOutput);

  // Immediately Insert into Supabase Database
  const createdQuiz = await quizService.createQuiz({
    creatorId,
    title: structuredQuiz.title,
    description: structuredQuiz.description || `AI-Generated quiz via ${providerUsed}`,
    questions: structuredQuiz.questions
  });

  return {
    quiz: createdQuiz,
    providerUsed,
    questionCount: structuredQuiz.questions.length
  };
}
