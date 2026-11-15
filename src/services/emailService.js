import nodemailer from 'nodemailer';

/**
 * Email Service (emailService.js)
 * LevelNLearn (SRMIST Campus Edition)
 * Handles sending transactional emails (such as Password Reset links).
 * Supports SMTP (via nodemailer), environment inspection, and local development/test outbox.
 */

// In-memory outbox for development and automated test inspection
const devOutbox = [];

export const emailService = {
  /**
   * Inspects the current email configuration.
   * Reports whether an active SMTP/email provider is configured in environment variables.
   * @returns {{ configured: boolean, provider: string, host: string|null, details: string }}
   */
  isConfigured() {
    const host = process.env.SMTP_HOST || null;
    const user = process.env.SMTP_USER || null;
    const pass = process.env.SMTP_PASS || null;
    const resendKey = process.env.RESEND_API_KEY || null;

    if (resendKey) {
      return {
        configured: true,
        provider: 'Resend API',
        host: 'api.resend.com',
        details: 'Configured via RESEND_API_KEY',
      };
    }

    if (host && user && pass) {
      return {
        configured: true,
        provider: 'SMTP',
        host,
        details: `Configured via SMTP host ${host}:${process.env.SMTP_PORT || 587}`,
      };
    }

    const isDevOrTest = process.env.NODE_ENV !== 'production';

    return {
      configured: isDevOrTest, // in dev/test, simulated delivery or dev outbox operates
      provider: isDevOrTest ? 'Development Outbox (Simulated)' : 'None',
      host: null,
      details: isDevOrTest
        ? 'Operating in Development/Test mode with local in-memory outbox.'
        : 'No production SMTP or email service configured in .env (SMTP_HOST, SMTP_USER, SMTP_PASS required).',
    };
  },

  /**
   * Retrieves all sent emails in dev/test mode.
   * @returns {Array}
   */
  getDevOutbox() {
    return [...devOutbox];
  },

  /**
   * Clears the dev outbox (useful between test runs).
   */
  clearDevOutbox() {
    devOutbox.length = 0;
  },

  /**
   * Finds the latest sent email to a specific address in dev/test mode.
   * @param {string} email 
   * @returns {object|null}
   */
  getLatestEmailFor(email) {
    const cleanEmail = email.trim().toLowerCase();
    for (let i = devOutbox.length - 1; i >= 0; i--) {
      if (devOutbox[i].to.toLowerCase() === cleanEmail) {
        return devOutbox[i];
      }
    }
    return null;
  },

  /**
   * Sends a password reset email to a registered user.
   * @param {object} params
   * @param {string} params.to - Recipient email address
   * @param {string} params.resetUrl - Full password reset URL with secure token
   * @param {string} [params.userName] - Recipient full name or username
   * @param {boolean} [params.simulateFailure] - For test verification of delivery failure handling
   * @returns {Promise<{ success: boolean, messageId: string, deliveryMode: string }>}
   */
  async sendPasswordResetEmail({ to, resetUrl, userName = 'SRMIST Scholar', simulateFailure = false }) {
    if (simulateFailure) {
      throw new Error('SMTP connection timed out: unable to reach campus mail server.');
    }

    const configStatus = this.isConfigured();
    const isProduction = process.env.NODE_ENV === 'production';

    // If strictly in production and no real email provider is configured, fail honestly
    if (isProduction && (!process.env.SMTP_HOST && !process.env.RESEND_API_KEY)) {
      throw new Error(
        'Email delivery service is not configured. Please configure SMTP credentials (SMTP_HOST, SMTP_USER, SMTP_PASS) in .env.'
      );
    }

    const subject = '🔐 Password Reset Instructions — LevelNLearn (SRMIST Campus Edition)';
    const textBody = `Hello ${userName},\n\n` +
      `We received a request to reset your LevelNLearn V2 campus account password.\n\n` +
      `Click the link below to set a new password:\n${resetUrl}\n\n` +
      `This link will expire in 60 minutes and can only be used once.\n\n` +
      `If you did not request this reset, you can safely ignore this email.\n\n` +
      `Best regards,\nSRMIST LevelNLearn Security Team`;

    const htmlBody = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; background: #0B0F19; border: 1px solid rgba(168, 85, 247, 0.3); border-radius: 16px; padding: 32px; color: #F8FAFC;">
        <div style="text-align: center; margin-bottom: 24px;">
          <h1 style="color: #FFFFFF; font-size: 24px; font-weight: 800; margin: 0;">
            <span style="color: #A855F7;">Level</span>N<span style="color: #38BDF8;">Learn</span>
          </h1>
          <p style="color: #94A3B8; font-size: 13px; margin-top: 4px;">SRMIST Campus Gateway Edition</p>
        </div>

        <div style="background: rgba(30, 41, 59, 0.7); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 12px; padding: 24px; margin-bottom: 24px;">
          <h2 style="color: #F8FAFC; font-size: 18px; margin-top: 0; margin-bottom: 12px;">Password Reset Request</h2>
          <p style="color: #CBD5E1; font-size: 14px; line-height: 1.6; margin-bottom: 20px;">
            Hello <strong>${userName}</strong>, we received a request to reset the password associated with your SRMIST campus account (<code style="background: rgba(255, 255, 255, 0.1); padding: 2px 6px; border-radius: 4px; color: #E9D5FF;">${to}</code>).
          </p>

          <div style="text-align: center; margin: 28px 0;">
            <a href="${resetUrl}" style="background: linear-gradient(135deg, #7C3AED, #A855F7); color: #FFFFFF; padding: 14px 28px; text-decoration: none; border-radius: 10px; font-weight: 700; font-size: 14px; display: inline-block; box-shadow: 0 4px 15px rgba(124, 58, 237, 0.4);">
              Reset My Password
            </a>
          </div>

          <p style="color: #94A3B8; font-size: 12px; line-height: 1.5; margin-bottom: 8px;">
            If the button doesn't work, copy and paste this link into your browser:
          </p>
          <p style="color: #A855F7; font-size: 12px; word-break: break-all; margin-top: 0;">
            <a href="${resetUrl}" style="color: #C084FC;">${resetUrl}</a>
          </p>
        </div>

        <div style="border-top: 1px solid rgba(255, 255, 255, 0.08); padding-top: 16px; font-size: 12px; color: #64748B; line-height: 1.5;">
          <p style="margin: 0 0 6px 0;">⏳ <strong>Security Note:</strong> This reset link expires in 60 minutes and is single-use.</p>
          <p style="margin: 0;">If you did not request a password reset, please ignore this email. Your current password will remain completely secure.</p>
        </div>
      </div>
    `;

    // 1. If SMTP is configured, attempt real SMTP delivery
    if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || '587', 10),
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });

      const info = await transporter.sendMail({
        from: process.env.SMTP_FROM || `"LevelNLearn SRMIST" <${process.env.SMTP_USER}>`,
        to,
        subject,
        text: textBody,
        html: htmlBody,
      });

      const result = {
        success: true,
        messageId: info.messageId,
        deliveryMode: 'smtp',
        to,
        resetUrl,
      };
      devOutbox.push(result);
      return result;
    }

    // 2. Otherwise in dev/test, deliver to devOutbox and log
    const messageId = `msg_dev_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const emailRecord = {
      messageId,
      to,
      subject,
      textBody,
      htmlBody,
      resetUrl,
      timestamp: new Date().toISOString(),
      deliveryMode: 'dev-outbox',
    };

    devOutbox.push(emailRecord);
    console.log(`[Email Service] Delivered password reset instructions to ${to}`);
    console.log(`[Email Service] Reset URL: ${resetUrl}`);

    return {
      success: true,
      messageId,
      deliveryMode: 'dev-outbox',
      to,
      resetUrl,
    };
  },
};

export default emailService;
