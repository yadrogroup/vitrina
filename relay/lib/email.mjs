import nodemailer from 'nodemailer';

let transporter;

function getTransporter() {
  if (transporter) return transporter;

  const host = process.env.SMTP_HOST?.trim();
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS?.trim();

  if (!host || !user || !pass) {
    return null;
  }

  transporter = nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT || 465),
    secure: process.env.SMTP_SECURE !== '0',
    auth: { user, pass },
  });

  return transporter;
}

export async function sendEmailOrder({ to, subject, text, siteName }) {
  const transport = getTransporter();
  if (!transport) {
    return { ok: false, skipped: true, reason: 'SMTP не настроен' };
  }

  const from = process.env.SMTP_FROM?.trim() || process.env.SMTP_USER;

  await transport.sendMail({
    from,
    to,
    subject: subject || `Новый заказ — ${siteName}`,
    text,
  });

  return { ok: true };
}
