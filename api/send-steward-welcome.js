const {
  composeStewardWelcomeEmail,
  sendViaResend,
} = require('../lib/steward-welcome-email');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  try {
    const payload = req.body || {};
    const emailPayload = await composeStewardWelcomeEmail(payload);

    const shouldSend = String(payload.send ?? 'true').toLowerCase() !== 'false';

    if (!shouldSend) {
      return res.status(200).json({
        ok: true,
        preview: true,
        to: emailPayload.to,
        subject: emailPayload.subject,
        setupLink: emailPayload.setupLink,
      });
    }

    const sendResult = await sendViaResend(emailPayload);

    return res.status(200).json({
      ok: true,
      preview: false,
      to: emailPayload.to,
      subject: emailPayload.subject,
      setupLink: emailPayload.setupLink,
      resend: sendResult,
    });
  } catch (error) {
    return res.status(400).json({
      ok: false,
      error: error.message || 'Failed to send Steward welcome email.',
    });
  }
};
