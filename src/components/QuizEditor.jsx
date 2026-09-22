import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, Plus, Trash2, ArrowUp, ArrowDown, Image as ImageIcon, 
  CheckCircle2, AlertCircle, Loader2, Save, HelpCircle, Sparkles, Upload
} from 'lucide-react';
import { GlassCard, Badge } from './common/UIComponents.jsx';
import '../styles/globals.css';

/**
 * QuizEditor Component - LevelNLearn (SRMIST Campus Edition)
 * Full-featured modal editor for manually created, AI-generated, and saved quizzes.
 * Supports title, description, questions, 4 options, correct answer selection,
 * difficulty tier, question reordering, image attachments (upload/URL), and deletion.
 */
export function QuizEditor({ quizId, isOpen, onClose, onQuizSaved, currentUser }) {
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Form State
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [questions, setQuestions] = useState([]);
  
  // Image URL prompt modal/popover state per question
  const [urlInputIndex, setUrlInputIndex] = useState(null);
  const [tempImageUrl, setTempImageUrl] = useState('');
  const fileInputRef = useRef({});

  // Reset or load quiz data when opened
  useEffect(() => {
    if (!isOpen) {
      setErrorMsg('');
      setSuccessMsg('');
      return;
    }

    if (quizId) {
      loadQuiz(quizId);
    } else {
      // New blank manual quiz
      setTitle('');
      setDescription('');
      setQuestions([
        {
          question_text: '',
          options: ['', '', '', ''],
          correct_option: 0,
          difficulty_tier: 'medium',
          image_url: null,
        }
      ]);
      setErrorMsg('');
      setSuccessMsg('');
    }
  }, [isOpen, quizId]);

  // Load existing quiz from backend
  const loadQuiz = async (id) => {
    setIsLoading(true);
    setErrorMsg('');
    try {
      const token = currentUser?.token;
      const res = await fetch(`/api/quizzes/${id}?token=${encodeURIComponent(token || '')}`, {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {},
      });
      const result = await res.json();

      if (!res.ok || !result.success || !result.data) {
        throw new Error(result.error || 'Failed to load quiz data');
      }

      const qData = result.data;
      setTitle(qData.title || '');
      setDescription(qData.description || '');

      const loadedQuestions = (qData.questions || []).map((q) => {
        let opts = Array.isArray(q.options) ? [...q.options] : ['', '', '', ''];
        while (opts.length < 4) opts.push('');
        return {
          id: q.id,
          question_text: q.question_text || '',
          options: opts.slice(0, 4),
          correct_option: typeof q.correct_option === 'number' ? q.correct_option : 0,
          difficulty_tier: q.difficulty_tier || 'medium',
          image_url: q.image_url || null,
        };
      });

      if (loadedQuestions.length === 0) {
        loadedQuestions.push({
          question_text: '',
          options: ['', '', '', ''],
          correct_option: 0,
          difficulty_tier: 'medium',
          image_url: null,
        });
      }

      setQuestions(loadedQuestions);
    } catch (err) {
      setErrorMsg(`Failed to load quiz: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Question mutators
  const handleQuestionTextChange = (index, value) => {
    setQuestions(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], question_text: value };
      return updated;
    });
  };

  const handleOptionChange = (qIndex, optIndex, value) => {
    setQuestions(prev => {
      const updated = [...prev];
      const newOpts = [...updated[qIndex].options];
      newOpts[optIndex] = value;
      updated[qIndex] = { ...updated[qIndex], options: newOpts };
      return updated;
    });
  };

  const handleCorrectOptionChange = (qIndex, optIndex) => {
    setQuestions(prev => {
      const updated = [...prev];
      updated[qIndex] = { ...updated[qIndex], correct_option: optIndex };
      return updated;
    });
  };

  const handleDifficultyChange = (qIndex, tier) => {
    setQuestions(prev => {
      const updated = [...prev];
      updated[qIndex] = { ...updated[qIndex], difficulty_tier: tier };
      return updated;
    });
  };

  const handleAddQuestion = () => {
    setQuestions(prev => [
      ...prev,
      {
        question_text: '',
        options: ['', '', '', ''],
        correct_option: 0,
        difficulty_tier: 'medium',
        image_url: null,
      }
    ]);
  };

  const handleDeleteQuestion = (index) => {
    if (questions.length <= 1) {
      setErrorMsg('A quiz must have at least one question.');
      return;
    }
    setQuestions(prev => prev.filter((_, idx) => idx !== index));
  };

  const handleMoveQuestion = (index, direction) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= questions.length) return;
    setQuestions(prev => {
      const updated = [...prev];
      const temp = updated[index];
      updated[index] = updated[targetIndex];
      updated[targetIndex] = temp;
      return updated;
    });
  };

  // Image handling
  const handleFileUpload = (qIndex, e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setErrorMsg('Please select a valid image file (PNG, JPG, WEBP, GIF).');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setErrorMsg('Image file size exceeds 5MB limit.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (loadEvent) => {
      const dataUrl = loadEvent.target?.result;
      if (typeof dataUrl === 'string') {
        setQuestions(prev => {
          const updated = [...prev];
          updated[qIndex] = { ...updated[qIndex], image_url: dataUrl };
          return updated;
        });
      }
    };
    reader.readAsDataURL(file);
  };

  const handleApplyImageUrl = (qIndex) => {
    if (!tempImageUrl.trim()) {
      setUrlInputIndex(null);
      return;
    }
    setQuestions(prev => {
      const updated = [...prev];
      updated[qIndex] = { ...updated[qIndex], image_url: tempImageUrl.trim() };
      return updated;
    });
    setTempImageUrl('');
    setUrlInputIndex(null);
  };

  const handleRemoveImage = (qIndex) => {
    setQuestions(prev => {
      const updated = [...prev];
      updated[qIndex] = { ...updated[qIndex], image_url: null };
      return updated;
    });
    if (fileInputRef.current[qIndex]) {
      fileInputRef.current[qIndex].value = '';
    }
  };

  // Frontend Validation
  const validateForm = () => {
    if (!title.trim()) {
      setErrorMsg('Quiz title is required.');
      return false;
    }
    if (!questions || questions.length === 0) {
      setErrorMsg('Quiz must contain at least one question.');
      return false;
    }

    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (!q.question_text.trim()) {
        setErrorMsg(`Question ${i + 1} text cannot be empty.`);
        return false;
      }
      if (!Array.isArray(q.options) || q.options.length < 2) {
        setErrorMsg(`Question ${i + 1} must have options.`);
        return false;
      }
      for (let j = 0; j < q.options.length; j++) {
        if (!q.options[j].trim()) {
          setErrorMsg(`Question ${i + 1}, Option ${String.fromCharCode(65 + j)} cannot be empty.`);
          return false;
        }
      }
      if (q.correct_option < 0 || q.correct_option >= q.options.length) {
        setErrorMsg(`Question ${i + 1} must have a valid correct option selected.`);
        return false;
      }
    }

    return true;
  };

  // Save changes
  const handleSaveQuiz = async (e) => {
    e?.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!validateForm()) return;

    setIsSaving(true);
    try {
      const token = currentUser?.token;
      const payload = {
        token,
        title: title.trim(),
        description: description.trim(),
        questions: questions.map(q => ({
          question_text: q.question_text.trim(),
          options: q.options.map(opt => opt.trim()),
          correct_option: q.correct_option,
          difficulty_tier: q.difficulty_tier || 'medium',
          image_url: q.image_url || null,
        })),
      };

      const url = quizId ? `/api/quizzes/${quizId}` : '/api/quizzes';
      const method = quizId ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      });

      const result = await res.json();

      if (!res.ok || !result.success) {
        throw new Error(result.error || 'Failed to save quiz to database.');
      }

      setSuccessMsg(quizId ? 'Quiz updated successfully!' : 'Quiz created successfully!');
      if (onQuizSaved) {
        onQuizSaved(result.data);
      }

      setTimeout(() => {
        onClose();
      }, 1200);
    } catch (err) {
      setErrorMsg(err.message || 'Server error saving quiz');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="anti-cheat-blur-overlay" style={{ zIndex: 100, overflowY: 'auto', padding: '24px 16px' }}>
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        style={{ width: '100%', maxWidth: '860px', margin: 'auto' }}
      >
        <GlassCard 
          variant="highlight" 
          style={{ 
            border: '1.5px solid rgba(168, 85, 247, 0.45)', 
            boxShadow: '0 0 45px rgba(124, 58, 237, 0.3)',
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column',
            padding: 0,
            overflow: 'hidden'
          }}
        >
          {/* HEADER */}
          <div style={{ padding: '20px 24px', borderBottom: '1px solid rgba(255, 255, 255, 0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(15, 23, 42, 0.6)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(124, 58, 237, 0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#C084FC' }}>
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h2 style={{ fontSize: '20px', fontWeight: '800', color: '#F8FAFC' }}>
                  {quizId ? 'Edit Quiz' : 'Create Manual Quiz'}
                </h2>
                <p style={{ color: '#94A3B8', fontSize: '12px' }}>
                  {quizId ? 'Modify questions, answers, difficulty & images' : 'Author custom questions for your live arena'}
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              disabled={isSaving}
              style={{ background: 'transparent', border: 'none', color: '#94A3B8', cursor: 'pointer', padding: '6px' }}
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* SCROLLABLE BODY */}
          <div style={{ padding: '24px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '20px' }}>
            
            {/* ALERTS */}
            {errorMsg && (
              <div className="error-alert" style={{ margin: 0 }}>
                <AlertCircle className="w-5 h-5 shrink-0 text-red-400" />
                <span>{errorMsg}</span>
              </div>
            )}

            {successMsg && (
              <div className="error-alert" style={{ margin: 0, background: 'rgba(16, 185, 129, 0.15)', borderColor: 'rgba(16, 185, 129, 0.4)', color: '#34D399' }}>
                <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-400" />
                <span>{successMsg}</span>
              </div>
            )}

            {isLoading ? (
              <div style={{ textAlign: 'center', padding: '60px 0' }}>
                <Loader2 className="w-10 h-10 animate-spin text-purple-400" style={{ margin: '0 auto 16px auto' }} />
                <p style={{ color: '#94A3B8', fontSize: '14px' }}>Loading quiz from campus database...</p>
              </div>
            ) : (
              <>
                {/* QUIZ HEADER FIELDS */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '14px', background: 'rgba(15, 23, 42, 0.5)', padding: '16px', borderRadius: '14px', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#E2E8F0', marginBottom: '6px' }}>
                      Quiz Title <span style={{ color: '#EF4444' }}>*</span>
                    </label>
                    <input
                      id="quiz-editor-title-input"
                      type="text"
                      placeholder="e.g. Operating Systems: Virtual Memory"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      style={{
                        width: '100%',
                        background: 'rgba(15, 23, 42, 0.85)',
                        border: '1px solid rgba(255, 255, 255, 0.15)',
                        borderRadius: '10px',
                        padding: '12px 14px',
                        color: '#F8FAFC',
                        fontSize: '15px',
                        fontWeight: '600',
                        outline: 'none',
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#E2E8F0', marginBottom: '6px' }}>
                      Description / Topic Notes
                    </label>
                    <textarea
                      id="quiz-editor-desc-input"
                      rows={2}
                      placeholder="Brief context about this quiz set..."
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      style={{
                        width: '100%',
                        background: 'rgba(15, 23, 42, 0.85)',
                        border: '1px solid rgba(255, 255, 255, 0.15)',
                        borderRadius: '10px',
                        padding: '10px 14px',
                        color: '#F8FAFC',
                        fontSize: '13px',
                        outline: 'none',
                        resize: 'none',
                      }}
                    />
                  </div>
                </div>

                {/* QUESTIONS SECTION */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <h3 style={{ fontSize: '16px', fontWeight: '800', color: '#F8FAFC' }}>
                      Questions ({questions.length})
                    </h3>
                    <span style={{ fontSize: '12px', color: '#94A3B8' }}>Click radio to set correct answer</span>
                  </div>

                  <button
                    id="add-question-btn"
                    type="button"
                    onClick={handleAddQuestion}
                    className="btn-glass"
                    style={{ padding: '8px 14px', borderRadius: '10px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}
                  >
                    <Plus className="w-3.5 h-3.5 text-purple-400" />
                    <span>Add Question</span>
                  </button>
                </div>

                {/* QUESTION CARDS */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                  {questions.map((q, qIdx) => (
                    <div
                      key={q.id || qIdx}
                      data-testid={`question-item-${qIdx}`}
                      style={{
                        background: 'rgba(15, 23, 42, 0.75)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        borderRadius: '14px',
                        padding: '18px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '14px',
                      }}
                    >
                      {/* CARD BAR */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span style={{ background: '#7C3AED', color: 'white', width: '26px', height: '26px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: '800' }}>
                            {qIdx + 1}
                          </span>
                          <span style={{ fontSize: '13px', fontWeight: '700', color: '#C084FC' }}>
                            Question {qIdx + 1}
                          </span>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          {/* DIFFICULTY SELECTOR */}
                          <select
                            value={q.difficulty_tier}
                            onChange={(e) => handleDifficultyChange(qIdx, e.target.value)}
                            style={{
                              background: 'rgba(15, 23, 42, 0.9)',
                              border: '1px solid rgba(255, 255, 255, 0.15)',
                              borderRadius: '8px',
                              padding: '5px 10px',
                              color: '#F8FAFC',
                              fontSize: '12px',
                              outline: 'none',
                            }}
                          >
                            <option value="easy">Easy (10 AP)</option>
                            <option value="medium">Medium (15 AP)</option>
                            <option value="hard">Hard (25 AP)</option>
                          </select>

                          {/* REORDER UP */}
                          <button
                            type="button"
                            onClick={() => handleMoveQuestion(qIdx, -1)}
                            disabled={qIdx === 0}
                            style={{ background: 'rgba(255, 255, 255, 0.05)', border: 'none', color: qIdx === 0 ? '#475569' : '#94A3B8', borderRadius: '6px', padding: '6px', cursor: qIdx === 0 ? 'not-allowed' : 'pointer' }}
                            title="Move Up"
                          >
                            <ArrowUp className="w-3.5 h-3.5" />
                          </button>

                          {/* REORDER DOWN */}
                          <button
                            type="button"
                            onClick={() => handleMoveQuestion(qIdx, 1)}
                            disabled={qIdx === questions.length - 1}
                            style={{ background: 'rgba(255, 255, 255, 0.05)', border: 'none', color: qIdx === questions.length - 1 ? '#475569' : '#94A3B8', borderRadius: '6px', padding: '6px', cursor: qIdx === questions.length - 1 ? 'not-allowed' : 'pointer' }}
                            title="Move Down"
                          >
                            <ArrowDown className="w-3.5 h-3.5" />
                          </button>

                          {/* DELETE QUESTION */}
                          <button
                            type="button"
                            onClick={() => handleDeleteQuestion(qIdx)}
                            disabled={questions.length <= 1}
                            style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', color: questions.length <= 1 ? '#475569' : '#EF4444', borderRadius: '6px', padding: '6px', cursor: questions.length <= 1 ? 'not-allowed' : 'pointer' }}
                            title="Delete Question"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* QUESTION TEXT INPUT */}
                      <div>
                        <input
                          type="text"
                          placeholder={`Enter statement for Question ${qIdx + 1}...`}
                          value={q.question_text}
                          onChange={(e) => handleQuestionTextChange(qIdx, e.target.value)}
                          style={{
                            width: '100%',
                            background: 'rgba(15, 23, 42, 0.9)',
                            border: '1px solid rgba(255, 255, 255, 0.12)',
                            borderRadius: '10px',
                            padding: '12px 14px',
                            color: '#F8FAFC',
                            fontSize: '14px',
                            outline: 'none',
                          }}
                        />
                      </div>

                      {/* QUESTION IMAGE SECTION */}
                      <div style={{ background: 'rgba(0, 0, 0, 0.25)', padding: '12px 14px', borderRadius: '10px', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
                        {q.image_url ? (
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                              <img
                                src={q.image_url}
                                alt={`Question ${qIdx + 1} Preview`}
                                style={{ width: '60px', height: '60px', objectFit: 'cover', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.2)' }}
                              />
                              <div>
                                <span style={{ fontSize: '13px', fontWeight: '700', color: '#F8FAFC', display: 'block' }}>
                                  Attached Image
                                </span>
                                <span style={{ fontSize: '11px', color: '#34D399' }}>
                                  ✓ Visual attached to question
                                </span>
                              </div>
                            </div>

                            <div style={{ display: 'flex', gap: '8px' }}>
                              {/* REPLACE IMAGE */}
                              <input
                                type="file"
                                accept="image/*"
                                style={{ display: 'none' }}
                                ref={el => fileInputRef.current[qIdx] = el}
                                onChange={(e) => handleFileUpload(qIdx, e)}
                              />
                              <button
                                type="button"
                                onClick={() => fileInputRef.current[qIdx]?.click()}
                                className="btn-glass"
                                style={{ padding: '6px 12px', fontSize: '11px', borderRadius: '8px' }}
                              >
                                Replace Image
                              </button>

                              {/* REMOVE IMAGE */}
                              <button
                                type="button"
                                onClick={() => handleRemoveImage(qIdx)}
                                style={{ background: 'rgba(239, 68, 68, 0.12)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#EF4444', padding: '6px 12px', fontSize: '11px', borderRadius: '8px', cursor: 'pointer' }}
                              >
                                Remove
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div>
                            {urlInputIndex === qIdx ? (
                              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                <input
                                  type="url"
                                  placeholder="Paste image URL (https://...)"
                                  value={tempImageUrl}
                                  onChange={(e) => setTempImageUrl(e.target.value)}
                                  style={{
                                    flex: 1,
                                    background: 'rgba(15, 23, 42, 0.9)',
                                    border: '1px solid rgba(255, 255, 255, 0.15)',
                                    borderRadius: '8px',
                                    padding: '8px 12px',
                                    color: '#F8FAFC',
                                    fontSize: '12px',
                                    outline: 'none',
                                  }}
                                />
                                <button
                                  type="button"
                                  onClick={() => handleApplyImageUrl(qIdx)}
                                  className="btn-green-action"
                                  style={{ padding: '8px 14px', fontSize: '12px', borderRadius: '8px' }}
                                >
                                  Apply
                                </button>
                                <button
                                  type="button"
                                  onClick={() => { setUrlInputIndex(null); setTempImageUrl(''); }}
                                  style={{ background: 'transparent', border: 'none', color: '#94A3B8', fontSize: '12px', cursor: 'pointer' }}
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#94A3B8', fontSize: '12px' }}>
                                  <ImageIcon className="w-4 h-4 text-purple-400" />
                                  <span>No image attached</span>
                                </div>
                                <div style={{ display: 'flex', gap: '8px' }}>
                                  <input
                                    type="file"
                                    accept="image/*"
                                    style={{ display: 'none' }}
                                    ref={el => fileInputRef.current[qIdx] = el}
                                    onChange={(e) => handleFileUpload(qIdx, e)}
                                  />
                                  <button
                                    type="button"
                                    onClick={() => fileInputRef.current[qIdx]?.click()}
                                    className="btn-glass"
                                    style={{ padding: '6px 12px', fontSize: '11px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '4px' }}
                                  >
                                    <Upload className="w-3 h-3" />
                                    <span>Upload File</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => { setUrlInputIndex(qIdx); setTempImageUrl(''); }}
                                    className="btn-glass"
                                    style={{ padding: '6px 12px', fontSize: '11px', borderRadius: '8px' }}
                                  >
                                    Paste URL
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* 4 OPTIONS GRID */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '10px' }}>
                        {q.options.map((opt, optIdx) => {
                          const isCorrect = q.correct_option === optIdx;
                          return (
                            <div
                              key={optIdx}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                background: isCorrect ? 'rgba(16, 185, 129, 0.12)' : 'rgba(15, 23, 42, 0.85)',
                                border: `1px solid ${isCorrect ? 'rgba(16, 185, 129, 0.45)' : 'rgba(255, 255, 255, 0.1)'}`,
                                borderRadius: '10px',
                                padding: '8px 12px',
                                transition: 'all 0.2s ease',
                              }}
                            >
                              {/* CORRECT RADIO TOGGLE */}
                              <button
                                type="button"
                                onClick={() => handleCorrectOptionChange(qIdx, optIdx)}
                                style={{
                                  width: '24px',
                                  height: '24px',
                                  borderRadius: '50%',
                                  background: isCorrect ? '#10B981' : '#1E293B',
                                  border: `1.5px solid ${isCorrect ? '#34D399' : 'rgba(255, 255, 255, 0.3)'}`,
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  color: '#0F172A',
                                  fontSize: '11px',
                                  fontWeight: '900',
                                  cursor: 'pointer',
                                  flexShrink: 0,
                                }}
                                title="Mark as correct answer"
                              >
                                {['A', 'B', 'C', 'D'][optIdx]}
                              </button>

                              <input
                                type="text"
                                placeholder={`Option ${['A', 'B', 'C', 'D'][optIdx]}...`}
                                value={opt}
                                onChange={(e) => handleOptionChange(qIdx, optIdx, e.target.value)}
                                style={{
                                  flex: 1,
                                  background: 'transparent',
                                  border: 'none',
                                  color: '#F8FAFC',
                                  fontSize: '13px',
                                  outline: 'none',
                                }}
                              />

                              {isCorrect && (
                                <Badge variant="green">CORRECT</Badge>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* FOOTER ACTIONS */}
          <div style={{ padding: '16px 24px', borderTop: '1px solid rgba(255, 255, 255, 0.1)', display: 'flex', justifyContent: 'flex-end', gap: '12px', background: 'rgba(15, 23, 42, 0.8)' }}>
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="btn-glass"
              style={{ padding: '10px 20px', borderRadius: '10px', fontSize: '13px' }}
            >
              Cancel
            </button>

            <button
              id="quiz-editor-save-btn"
              type="button"
              onClick={handleSaveQuiz}
              disabled={isSaving || isLoading}
              className="btn-primary-gradient"
              style={{ padding: '10px 24px', borderRadius: '10px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Saving to Database...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>Save Quiz</span>
                </>
              )}
            </button>
          </div>
        </GlassCard>
      </motion.div>
    </div>
  );
}

export default QuizEditor;
