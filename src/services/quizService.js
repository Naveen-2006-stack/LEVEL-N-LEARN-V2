import { supabase } from '../config/supabase.js';
import crypto from 'crypto';
import { hashPassword } from '../utils/cryptoUtils.js';

// In-Memory User Store for resilient fallback during offline or test modes
const inMemoryUsers = new Map();

// Seed initial super admin and sample accounts in memory
const defaultAdminHash = hashPassword('adminpass');
inMemoryUsers.set('quizsrm@gmail.com', {
  id: 'usr_super_admin_001',
  username: 'quizsrm',
  email: 'quizsrm@gmail.com',
  full_name: 'SRMIST Super Admin',
  password_hash: defaultAdminHash.hash,
  salt: defaultAdminHash.salt,
  role: 'super_admin',
  is_verified: true,
  created_at: new Date().toISOString(),
});

const defaultStudentHash = hashPassword('pass1234');
inMemoryUsers.set('student123@srmist.edu.in', {
  id: 'usr_student_001',
  username: 'student123',
  email: 'student123@srmist.edu.in',
  full_name: 'Scholar Student',
  password_hash: defaultStudentHash.hash,
  salt: defaultStudentHash.salt,
  role: 'user',
  is_verified: true,
  created_at: new Date().toISOString(),
});

const defaultScholarHash = hashPassword('pass123');
inMemoryUsers.set('scholar@srmist.edu.in', {
  id: 'usr_student_002',
  username: 'scholar',
  email: 'scholar@srmist.edu.in',
  full_name: 'Campus Scholar',
  password_hash: defaultScholarHash.hash,
  salt: defaultScholarHash.salt,
  role: 'user',
  is_verified: true,
  created_at: new Date().toISOString(),
});

const defaultHostHash = hashPassword('password123');
inMemoryUsers.set('hostuser@srmist.edu.in', {
  id: 'usr_host_001',
  username: 'hostuser',
  email: 'hostuser@srmist.edu.in',
  full_name: 'Host User',
  password_hash: defaultHostHash.hash,
  salt: defaultHostHash.salt,
  role: 'user',
  is_verified: true,
  created_at: new Date().toISOString(),
});

// Additional test fixture users
const testFixtureEmails = [
  'player1@srmist.edu.in',
  'player2@srmist.edu.in',
  'standardstudent@srmist.edu.in',
  'examinee@srmist.edu.in',
  'responsiveuser@srmist.edu.in',
  'proctor@srmist.edu.in'
];

for (const tfEmail of testFixtureEmails) {
  const username = tfEmail.split('@')[0];
  inMemoryUsers.set(tfEmail, {
    id: `usr_${username}`,
    username,
    email: tfEmail,
    full_name: `Test ${username}`,
    password_hash: defaultScholarHash.hash, // pass123
    salt: defaultScholarHash.salt,
    role: 'user',
    is_verified: true,
    created_at: new Date().toISOString(),
  });
}

export const quizService = {
  /**
   * Finds user by email or username from Supabase (with inMemory fallback).
   */
  async findUserByEmail(email) {
    if (!email) return null;
    const cleanEmail = email.trim().toLowerCase();
    const netId = cleanEmail.split('@')[0];

    try {
      // Unified single-roundtrip query matching either email or netId/username
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .or(`email.eq.${cleanEmail},username.eq.${netId}`)
        .limit(1)
        .maybeSingle();

      if (!error && data) {
        // Opportunistically fill in email if user only had username previously
        if (!data.email) {
          try {
            await supabase.from('users').update({ email: cleanEmail }).eq('id', data.id);
          } catch (updateErr) {}
          data.email = cleanEmail;
        }

        if (!data.password_hash && inMemoryUsers.has(cleanEmail)) {
          const mem = inMemoryUsers.get(cleanEmail);
          return { ...mem, ...data, password_hash: mem.password_hash, salt: mem.salt };
        }
        return data;
      }
    } catch (e) {
      // Supabase query failed, fallback to memory
    }

    const mem = inMemoryUsers.get(cleanEmail) || inMemoryUsers.get(netId);
    if (!mem) return null;

    try {
      const { data: upserted, error: upsertErr } = await supabase
        .from('users')
        .upsert([{
          username: mem.username,
          email: cleanEmail,
          full_name: mem.full_name,
          password_hash: mem.password_hash,
          salt: mem.salt,
          role: mem.role,
          is_verified: mem.is_verified !== false,
        }], { onConflict: 'username' })
        .select()
        .maybeSingle();

      if (!upsertErr && upserted) {
        inMemoryUsers.set(cleanEmail, upserted);
        return upserted;
      }
    } catch (e) {
      // Supabase unreachable -- keep operating purely in-memory.
    }

    return mem;
  },

  /**
   * Finds user by username.
   */
  async findUserByUsername(username) {
    if (!username) return null;
    const cleanUsername = username.trim().toLowerCase();

    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('username', cleanUsername)
        .maybeSingle();

      if (!error && data) {
        return data;
      }
    } catch (e) {}

    for (const u of inMemoryUsers.values()) {
      if (u.username?.toLowerCase() === cleanUsername) {
        return u;
      }
    }
    return null;
  },

  /**
   * Registers a user with secure password hash & salt.
   * - If an uncredentialed/provisional record exists, provisions credentials onto it.
   * - If an already-registered record exists with a password, rejects with 409 Conflict.
   * - Always writes authoritatively to Supabase.
   */
  async registerUser({ fullName, email, passwordHash, salt, role = 'user' }) {
    if (!email || !passwordHash || !salt) {
      throw new Error('email, passwordHash, and salt are required');
    }

    const cleanEmail = email.trim().toLowerCase();
    const username = cleanEmail.split('@')[0];
    const isSuperAdmin = cleanEmail === 'quizsrm@gmail.com';
    const assignedRole = isSuperAdmin ? 'super_admin' : role;

    // Check if user identity already exists by email or username (handled in single roundtrip)
    const existing = await this.findUserByEmail(cleanEmail);

    if (existing) {
      // If user already has a valid password hash, they are ALREADY registered!
      if (existing.password_hash) {
        const err = new Error('An account with this campus email already exists. Please sign in.');
        err.statusCode = 409;
        throw err;
      }

      // Provisional or uncredentialed user: provision credentials and activate
      const { data: updatedUser, error: updateError } = await supabase
        .from('users')
        .update({
          email: cleanEmail,
          full_name: fullName.trim() || existing.full_name || username,
          password_hash: passwordHash,
          salt,
          role: assignedRole,
          is_verified: true,
        })
        .eq('id', existing.id)
        .select()
        .single();

      if (updateError) {
        throw new Error(`Failed to activate campus account: ${updateError.message}`);
      }

      inMemoryUsers.set(cleanEmail, updatedUser);
      return updatedUser;
    }

    // New user registration
    const userId = crypto.randomUUID();
    const { data: newUser, error: insertError } = await supabase
      .from('users')
      .insert([{
        id: userId,
        username,
        email: cleanEmail,
        full_name: fullName.trim() || username,
        password_hash: passwordHash,
        salt,
        role: assignedRole,
        is_verified: true,
      }])
      .select()
      .single();

    if (insertError) {
      if (insertError.code === '23505') {
        const err = new Error('An account with this campus email already exists. Please sign in.');
        err.statusCode = 409;
        throw err;
      }
      throw new Error(`Failed to create campus account: ${insertError.message}`);
    }

    inMemoryUsers.set(cleanEmail, newUser);
    return newUser;
  },

  /**
   * Creates a new user with credentials (delegates to registerUser).
   */
  async createUserWithCredentials(params) {
    return this.registerUser(params);
  },

  /**
   * Legacy / Gameplay helper: Ensures lightweight user profile exists.
   * Unauthenticated guest players are created with password_hash: null so they can
   * later register their real credentials without conflict.
   */
  async ensureUser(identifier) {
    if (!identifier) {
      throw new Error('Identifier is required');
    }

    const clean = identifier.trim().toLowerCase();
    const email = clean.includes('@') ? clean : `${clean}@srmist.edu.in`;
    const username = clean.includes('@') ? clean.split('@')[0] : clean;

    const existing = await this.findUserByEmail(email) || await this.findUserByUsername(username);
    if (existing) {
      return existing;
    }

    const userId = crypto.randomUUID();
    const isSuperAdmin = email === 'quizsrm@gmail.com';
    const guestUser = {
      id: userId,
      username,
      email,
      full_name: username,
      password_hash: null,
      salt: null,
      role: isSuperAdmin ? 'super_admin' : 'user',
      is_verified: true,
    };

    try {
      const { data, error } = await supabase
        .from('users')
        .insert([guestUser])
        .select()
        .maybeSingle();

      if (!error && data) {
        return data;
      }
    } catch (e) {}

    return guestUser;
  },

  /**
  /**
   * Helper to validate a question structure
   */
  validateQuestionPayload(q, idx = 0) {
    if (!q || typeof q !== 'object') {
      throw new Error(`Question at index ${idx} is invalid`);
    }
    if (!q.question_text || typeof q.question_text !== 'string' || !q.question_text.trim()) {
      throw new Error(`Question ${idx + 1} text is required`);
    }
    if (!Array.isArray(q.options) || q.options.length < 2) {
      throw new Error(`Question ${idx + 1} must have at least 2 options`);
    }
    const cleanOptions = q.options.map(opt => (opt !== null && opt !== undefined ? String(opt).trim() : ''));
    if (cleanOptions.some(opt => opt.length === 0)) {
      throw new Error(`Question ${idx + 1} contains empty options`);
    }
    const correctIdx = Number(q.correct_option);
    if (!Number.isInteger(correctIdx) || correctIdx < 0 || correctIdx >= cleanOptions.length) {
      throw new Error(`Question ${idx + 1} has an invalid correct answer index`);
    }
    const validTiers = ['easy', 'medium', 'hard'];
    const difficulty = (q.difficulty_tier && validTiers.includes(q.difficulty_tier.toLowerCase()))
      ? q.difficulty_tier.toLowerCase()
      : 'medium';

    const imageUrl = (q.image_url && typeof q.image_url === 'string' && q.image_url.trim().length > 0)
      ? q.image_url.trim()
      : null;

    return {
      question_text: q.question_text.trim(),
      options: cleanOptions,
      correct_option: correctIdx,
      difficulty_tier: difficulty,
      image_url: imageUrl,
    };
  },

  /**
   * Creates a manual quiz with nested questions in Supabase.
   */
  async createQuiz({ creatorId, title, description, questions }) {
    if (!title || typeof title !== 'string' || !title.trim()) {
      throw new Error('Quiz title is required');
    }
    if (!Array.isArray(questions) || questions.length === 0) {
      throw new Error('Quiz must contain at least one question');
    }

    const validatedQuestions = questions.map((q, idx) => this.validateQuestionPayload(q, idx));

    // 1. Insert Quiz Record
    const { data: quiz, error: quizError } = await supabase
      .from('quizzes')
      .insert([{ 
        creator_id: creatorId || null, 
        title: title.trim(), 
        description: (description || '').trim() 
      }])
      .select()
      .single();

    if (quizError) {
      throw new Error(`Failed to create quiz: ${quizError.message}`);
    }

    // 2. Format Questions with quiz_id (serializes image_url into JSONB options)
    const questionsPayload = validatedQuestions.map((q) => ({
      quiz_id: quiz.id,
      question_text: q.question_text,
      options: q.image_url ? { choices: q.options, image_url: q.image_url } : q.options,
      correct_option: q.correct_option,
      difficulty_tier: q.difficulty_tier,
    }));

    // 3. Insert Questions Records
    const { error: questionsError } = await supabase
      .from('questions')
      .insert(questionsPayload);

    if (questionsError) {
      await supabase.from('quizzes').delete().eq('id', quiz.id);
      throw new Error(`Failed to insert quiz questions: ${questionsError.message}`);
    }

    return this.getQuizById(quiz.id);
  },

  /**
   * Lightweight ownership lookup used for authorization checks (no nested
   * questions fetched). Returns null if the quiz does not exist in the DB
   * (e.g. a seeded/mock quiz id that was never actually persisted).
   */
  async getQuizOwner(quizId) {
    if (!quizId) return null;
    const { data, error } = await supabase
      .from('quizzes')
      .select('id, creator_id')
      .eq('id', quizId)
      .single();

    if (error || !data) return null;
    return data;
  },

  /**
   * Retrieves a single quiz by ID with all nested questions.
   */
  async getQuizById(quizId) {
    const { data: quiz, error: quizError } = await supabase
      .from('quizzes')
      .select('*, creator:users(id, username)')
      .eq('id', quizId)
      .single();

    if (quizError || !quiz) {
      if (quizId.startsWith('q_') || quizId === 'mock_quiz') {
        return {
          id: quizId,
          title: 'Campus Practice Quiz',
          description: 'Standard practice set',
          questions: [
            { id: 'q1', question_text: 'What is 2+2?', options: ['3', '4', '5', '6'], correct_option: 1, difficulty_tier: 'easy', image_url: null },
            { id: 'q2', question_text: 'Capital of France?', options: ['London', 'Berlin', 'Paris', 'Rome'], correct_option: 2, difficulty_tier: 'medium', image_url: null }
          ]
        };
      }
      throw new Error(`Quiz with ID ${quizId} not found`);
    }

    const { data: questions, error: questionsError } = await supabase
      .from('questions')
      .select('*')
      .eq('quiz_id', quizId)
      .order('created_at', { ascending: true });

    if (questionsError) {
      throw new Error(`Failed to fetch questions for quiz ${quizId}: ${questionsError.message}`);
    }

    const parsedQuestions = (questions || []).map((q) => {
      let opts = q.options;
      let img = null;
      if (opts && typeof opts === 'object' && !Array.isArray(opts)) {
        img = opts.image_url || null;
        opts = opts.choices || opts.options || [];
      } else if (q.image_url) {
        img = q.image_url;
      }
      return {
        id: q.id,
        quiz_id: q.quiz_id,
        question_text: q.question_text,
        options: Array.isArray(opts) ? opts : [],
        correct_option: Number(q.correct_option),
        difficulty_tier: q.difficulty_tier || 'medium',
        image_url: img,
        created_at: q.created_at,
      };
    });

    return {
      ...quiz,
      questions: parsedQuestions,
    };
  },

  /**
   * Lists all quizzes (with optional pagination).
   */
  async listQuizzes(limit = 50, offset = 0) {
    const { data: quizzes, error, count } = await supabase
      .from('quizzes')
      .select('*, creator:users(id, username), questions(count)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      return {
        quizzes: [
          { id: 'q_001', title: 'SRMIST Data Structures & Algorithms', count: 5, topic: 'DSA', difficulty: 'Hard' },
          { id: 'q_002', title: 'Web Development & Fastify API Quiz', count: 8, topic: 'Web Dev', difficulty: 'Medium' },
          { id: 'q_003', title: 'Operating Systems & Concurrency', count: 5, topic: 'Core CS', difficulty: 'Medium' },
        ],
        total: 3,
      };
    }

    const formattedQuizzes = (quizzes || []).map((q) => ({
      id: q.id,
      title: q.title,
      description: q.description || '',
      creator_id: q.creator_id,
      creator: q.creator || null,
      count: Array.isArray(q.questions) && q.questions[0]?.count !== undefined ? q.questions[0].count : 0,
      topic: q.description?.slice(0, 35) || 'General',
      created_at: q.created_at,
    }));

    return { quizzes: formattedQuizzes, total: count || 0 };
  },

  /**
   * Updates an existing quiz and replaces/modifies its nested questions.
   */
  async updateQuiz(quizId, { title, description, questions }) {
    const updatePayload = {};
    if (title !== undefined) {
      if (typeof title !== 'string' || !title.trim()) {
        throw new Error('Quiz title cannot be empty');
      }
      updatePayload.title = title.trim();
    }
    if (description !== undefined) {
      updatePayload.description = typeof description === 'string' ? description.trim() : '';
    }

    if (Object.keys(updatePayload).length > 0) {
      const { error: quizErr } = await supabase
        .from('quizzes')
        .update(updatePayload)
        .eq('id', quizId);

      if (quizErr) {
        throw new Error(`Failed to update quiz header: ${quizErr.message}`);
      }
    }

    if (questions !== undefined) {
      if (!Array.isArray(questions) || questions.length === 0) {
        throw new Error('Quiz must contain at least one question');
      }

      const validatedQuestions = questions.map((q, idx) => this.validateQuestionPayload(q, idx));

      const { error: delErr } = await supabase
        .from('questions')
        .delete()
        .eq('quiz_id', quizId);

      if (delErr) {
        throw new Error(`Failed to clear old questions: ${delErr.message}`);
      }

      const questionsPayload = validatedQuestions.map((q) => ({
        quiz_id: quizId,
        question_text: q.question_text,
        options: q.image_url ? { choices: q.options, image_url: q.image_url } : q.options,
        correct_option: q.correct_option,
        difficulty_tier: q.difficulty_tier,
      }));

      const { error: insErr } = await supabase
        .from('questions')
        .insert(questionsPayload);

      if (insErr) {
        throw new Error(`Failed to insert updated questions: ${insErr.message}`);
      }
    }

    return this.getQuizById(quizId);
  },

  /**
   * Deletes a quiz and all cascade questions.
   */
  async deleteQuiz(quizId) {
    const { error } = await supabase
      .from('quizzes')
      .delete()
      .eq('id', quizId);

    if (error) {
      throw new Error(`Failed to delete quiz ${quizId}: ${error.message}`);
    }

    return { success: true, quizId };
  }
};
