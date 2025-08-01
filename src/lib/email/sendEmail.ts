import nodemailer from "nodemailer";
import dotenv from "dotenv";
dotenv.config();

interface SendEmailOptions {
  to: string;
  subject: string;
  content: string;
  interval?: number;
}

export async function sendEmail({ to, subject, content }: SendEmailOptions) {
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!user || !pass) throw new Error("SMTP Konfiguration fehlt!");

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user, pass },
  });

  await transporter.sendMail({
    from: user,
    to,
    subject,
    text: content,
  });
}
