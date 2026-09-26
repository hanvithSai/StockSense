import nodemailer from "nodemailer";

export function isMailConfigured(): boolean {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
}

export async function sendMail(message: MailMessage): Promise<void> {
  const port = Number(process.env.SMTP_PORT ?? 465);
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
  await transporter.sendMail({
    from: process.env.MAIL_FROM ?? process.env.SMTP_USER,
    ...message,
  });
}

export function otpEmail(name: string, code: string, minutes: number): Omit<MailMessage, "to"> {
  const text = `Hi ${name},\n\nYour StockSense password reset code is ${code}. It expires in ${minutes} minutes.\n\nIf you did not request this, you can ignore this email.`;
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;padding:24px;color:#1f1a1e">
      <h2 style="margin:0 0 8px;color:#714b67">StockSense</h2>
      <p>Hi ${name},</p>
      <p>Use this code to reset your password. It expires in ${minutes} minutes.</p>
      <p style="font-size:32px;font-weight:bold;letter-spacing:8px;margin:24px 0">${code}</p>
      <p style="color:#6b6470;font-size:13px">If you did not request a password reset, you can safely ignore this email.</p>
    </div>`;
  return { subject: "Your StockSense password reset code", text, html };
}
