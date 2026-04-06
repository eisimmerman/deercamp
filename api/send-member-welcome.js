const {
  composeMemberWelcomeEmail,
  sendViaResend,
} = require('../lib/member-welcome-email');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'Method not allowed. Use POST.' });
  }

  try {
    const payload =
      typeof req.body === 'string'
        ? JSON.parse(req.body || '{}')
        : (req.body || {});

    const emailPayload = await composeMemberWelcomeEmail(payload);
    const shouldSend = String(payload.send ?? 'true').toLowerCase() !== 'false';

    if (!shouldSend) {
      return res.status(200).json({
        ok: true,
        preview: true,
        to: emailPayload.to,
        subject: emailPayload.subject,
        inviteLink: emailPayload.inviteLink,
      });
    }

    const sendResult = await sendViaResend(emailPayload);

    return res.status(200).json({
      ok: true,
      preview: false,
      to: emailPayload.to,
      subject: emailPayload.subject,
      inviteLink: emailPayload.inviteLink,
      resend: sendResult,
    });
  } catch (error) {
    console.error('send-member-welcome failed', {
      message: error?.message || 'Unknown error',
      stack: error?.stack || '',
      bodyType: typeof req.body,
      hasBody: Boolean(req.body),
    });

    return res.status(400).json({
      ok: false,
      error: error?.message || 'Failed to send member welcome email.',
    });
  }
};
