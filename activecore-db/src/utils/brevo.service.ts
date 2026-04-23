import * as brevo from '@getbrevo/brevo';
import { logInfo, logError } from './logger';

// Initialize Brevo client
const brevoClient = new brevo.TransactionalEmailsApi();

if (process.env.BREVO_API_KEY) {
  brevoClient.setApiKey(brevo.TransactionalEmailsApiApiKeys.apiKey, process.env.BREVO_API_KEY);
} else {
  logError('BREVO_API_KEY is not set in environment variables', new Error('Missing BREVO_API_KEY'));
}

export interface EmailOptions {
  to: string | string[];
  subject: string;
  htmlContent: string;
  textContent?: string;
  replyTo?: string;
}

/**
 * Send email using Brevo
 */
export const sendEmail = async (options: EmailOptions): Promise<boolean> => {
  try {
    if (!process.env.BREVO_API_KEY) {
      logError('Brevo API key not configured', new Error('Missing BREVO_API_KEY'));
      return false;
    }

    const sendSmtpEmail = new brevo.SendSmtpEmail();
    sendSmtpEmail.subject = options.subject;
    sendSmtpEmail.htmlContent = options.htmlContent;
    sendSmtpEmail.textContent = options.textContent || options.htmlContent;

    // Handle both single email and array of emails
    const recipients = Array.isArray(options.to)
      ? options.to.map((email) => ({ email }))
      : [{ email: options.to }];
    sendSmtpEmail.to = recipients;

    // Set sender (from your Brevo verified sender)
    sendSmtpEmail.sender = {
      name: process.env.BREVO_SENDER_NAME || 'ActiveCore Gym',
      email: process.env.BREVO_SENDER_EMAIL || 'noreply@activecore.gym',
    };

    // Set reply-to if provided
    if (options.replyTo) {
      sendSmtpEmail.replyTo = { email: options.replyTo };
    }

    const response = await brevoClient.sendTransacEmail(sendSmtpEmail);
    const messageId = (response as any)?.messageId || (response as any)?.body?.messageId || 'unknown';
    logInfo(`Email sent successfully. Message ID: ${messageId}`);
    return true;
  } catch (error) {
    logError('Failed to send email via Brevo:', error);
    return false;
  }
};

/**
 * Send absence reminder email
 */
export const sendAbsenceReminderEmail = async (
  userEmail: string,
  userName: string,
  absenceDate: string,
  encouragingMessage: string
): Promise<boolean> => {
  const subject = `Absence Reminder - ${absenceDate}`;
  const htmlContent = `
    <html>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2>Hi ${userName},</h2>
          
          <p>We noticed you were absent on <strong>${absenceDate}</strong>.</p>
          
          <div style="background-color: #f0f7ff; padding: 15px; border-left: 4px solid #0066cc; margin: 20px 0;">
            <p><em>${encouragingMessage}</em></p>
          </div>
          
          <p>If you have any concerns about your attendance or need assistance, please reach out to our admin team.</p>
          
          <p>Best regards,<br><strong>ActiveCore Gym Management Team</strong></p>
        </div>
      </body>
    </html>
  `;

  const textContent = `
Hi ${userName},

We noticed you were absent on ${absenceDate}.

${encouragingMessage}

If you have any concerns about your attendance or need assistance, please reach out to our admin team.

Best regards,
ActiveCore Gym Management Team
  `;

  return sendEmail({
    to: userEmail,
    subject,
    htmlContent,
    textContent,
  });
};

/**
 * Send welcome email to new user
 */
export const sendWelcomeEmail = async (
  userEmail: string,
  userName: string,
  role: string
): Promise<boolean> => {
  const subject = 'Welcome to ActiveCore Gym!';
  const htmlContent = `
    <html>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2>Welcome to ActiveCore Gym, ${userName}!</h2>
          
          <p>Your account has been successfully created.</p>
          
          <div style="background-color: #f0f7ff; padding: 15px; border-left: 4px solid #0066cc; margin: 20px 0;">
            <p><strong>Account Details:</strong></p>
            <p>Email: ${userEmail}</p>
            <p>Role: ${role}</p>
          </div>
          
          <p>You can now log in to your account and start using our gym management system.</p>
          
          <p>If you have any questions, please don't hesitate to contact our support team.</p>
          
          <p>Best regards,<br><strong>ActiveCore Gym Management Team</strong></p>
        </div>
      </body>
    </html>
  `;

  return sendEmail({
    to: userEmail,
    subject,
    htmlContent,
  });
};
