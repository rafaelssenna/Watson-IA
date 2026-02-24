// Email Service using Zoho SMTP

import nodemailer from "nodemailer";

const ZOHO_EMAIL = process.env.ZOHO_EMAIL || "engenharia@helsenia.com.br";
const ZOHO_PASSWORD = process.env.ZOHO_PASSWORD || "";
const APP_NAME = "Watson IA";

// Zoho SMTP configuration
const transporter = nodemailer.createTransport({
  host: "smtp.zoho.com",
  port: 465,
  secure: true,
  auth: {
    user: ZOHO_EMAIL,
    pass: ZOHO_PASSWORD,
  },
});

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export async function sendEmail(options: SendEmailOptions): Promise<boolean> {
  try {
    if (!ZOHO_PASSWORD) {
      console.error("ZOHO_PASSWORD not configured");
      return false;
    }

    await transporter.sendMail({
      from: `"${APP_NAME}" <${ZOHO_EMAIL}>`,
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text || options.html.replace(/<[^>]*>/g, ""),
    });

    console.log(`Email sent to ${options.to}`);
    return true;
  } catch (error) {
    console.error("Error sending email:", error);
    return false;
  }
}

export async function sendPasswordResetEmail(
  email: string,
  resetToken: string,
  userName: string
): Promise<boolean> {
  // Deep link for mobile app or web fallback
  const resetLink = `watsonai://reset-password?token=${resetToken}`;
  const webResetLink = `https://app.watson-ia.com/reset-password?token=${resetToken}`;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Recuperar Senha - ${APP_NAME}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
    <tr>
      <td>
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #0d9488 0%, #0891b2 100%); padding: 32px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: bold;">${APP_NAME}</h1>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 40px 32px;">
              <h2 style="color: #1f2937; margin: 0 0 16px; font-size: 24px;">Ola, ${userName}!</h2>

              <p style="color: #4b5563; font-size: 16px; line-height: 24px; margin: 0 0 24px;">
                Recebemos uma solicitacao para redefinir a senha da sua conta no ${APP_NAME}.
              </p>

              <p style="color: #4b5563; font-size: 16px; line-height: 24px; margin: 0 0 32px;">
                Use o codigo abaixo para redefinir sua senha:
              </p>

              <!-- Code Box -->
              <div style="background-color: #f3f4f6; border-radius: 12px; padding: 24px; text-align: center; margin-bottom: 32px;">
                <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #0d9488;">${resetToken}</span>
              </div>

              <p style="color: #6b7280; font-size: 14px; line-height: 22px; margin: 0 0 24px;">
                Este codigo expira em <strong>1 hora</strong>.
              </p>

              <p style="color: #6b7280; font-size: 14px; line-height: 22px; margin: 0;">
                Se voce nao solicitou a redefinicao de senha, ignore este email. Sua senha permanecera a mesma.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f9fafb; padding: 24px 32px; text-align: center; border-top: 1px solid #e5e7eb;">
              <p style="color: #9ca3af; font-size: 12px; margin: 0;">
                ${APP_NAME} - Atendimento inteligente por WhatsApp
              </p>
              <p style="color: #9ca3af; font-size: 12px; margin: 8px 0 0;">
                Este e um email automatico, nao responda.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;

  return sendEmail({
    to: email,
    subject: `Recuperar senha - ${APP_NAME}`,
    html,
  });
}

export async function verifyEmailConnection(): Promise<boolean> {
  try {
    await transporter.verify();
    console.log("Email service connected successfully");
    return true;
  } catch (error) {
    console.error("Email service connection failed:", error);
    return false;
  }
}
