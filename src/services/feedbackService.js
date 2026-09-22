import { supabase } from '../config/supabase.js';

/**
 * Feedback Service (feedbackService.js)
 * Manages user feedback submissions and admin inbox interactions via Supabase JS client.
 */
export const feedbackService = {
  /**
   * Submit user feedback into public.feedback table
   */
  async submitFeedback(email, message) {
    if (!email || !message) {
      return { success: false, error: 'Email and message are required.' };
    }

    try {
      const { data, error } = await supabase
        .from('feedback')
        .insert([
          {
            user_email: email.trim().toLowerCase(),
            message: message.trim(),
            status: 'unread',
          },
        ])
        .select()
        .single();

      if (error) {
        throw new Error(error.message);
      }

      return { success: true, data };
    } catch (err) {
      console.error('[feedbackService] submitFeedback error:', err.message);
      return { success: false, error: err.message };
    }
  },

  /**
   * Fetch all feedback messages for Super Admin Inbox, ordered by created_at desc
   */
  async getAdminFeedback() {
    try {
      const { data, error } = await supabase
        .from('feedback')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        throw new Error(error.message);
      }

      return { success: true, data: data || [] };
    } catch (err) {
      console.error('[feedbackService] getAdminFeedback error:', err.message);
      return { success: false, error: err.message, data: [] };
    }
  },

  /**
   * Update feedback status to 'read' or 'resolved'
   */
  async updateFeedbackStatus(id, status) {
    if (!id || !status) {
      return { success: false, error: 'Feedback ID and status are required.' };
    }

    try {
      const { data, error } = await supabase
        .from('feedback')
        .update({ status })
        .eq('id', id)
        .select()
        .single();

      if (error) {
        throw new Error(error.message);
      }

      return { success: true, data };
    } catch (err) {
      console.error('[feedbackService] updateFeedbackStatus error:', err.message);
      return { success: false, error: err.message };
    }
  },
};

export default feedbackService;
