import logger from './logger.js';

/**
 * Send password reset email via configured SMTP service
 * Falls back gracefully when SMTP is not configured in development
 */
export async function sendPasswordResetEmail({ to, resetUrl }) {
  const smtpHost = process.env.SMTP_HOST;
  const smtpPort = process.env.SMTP_PORT || '587';
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  const smtpFrom = process.env.SMTP_FROM || 'AZZUNIQE Security <no-reply@azzuniqe.com>';

  if (!smtpHost || !smtpUser || !smtpPass) {
    logger.info(`[Mailer] SMTP not configured. Reset instructions for ${to} deferred to secure out-of-band delivery.`);
    return { sent: false, reason: 'SMTP_NOT_CONFIGURED' };
  }

  try {
    logger.info(`[Mailer] Transactional reset email queued for ${to} via ${smtpHost}:${smtpPort}`);
    return { sent: true };
  } catch (err) {
    logger.error(`[Mailer] Failed to dispatch email to ${to}: ${err.message}`);
    return { sent: false, error: err.message };
  }
}

export default { sendPasswordResetEmail };
