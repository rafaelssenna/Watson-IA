// Email Service using Resend
// Much simpler and more reliable than SMTP

import { Resend } from "resend";

const RESEND_API_KEY = process.env.RESEND_API_KEY || "";
const FROM_EMAIL = process.env.FROM_EMAIL || "Watson IA <onboarding@resend.dev>";
const APP_NAME = "Watson IA";

console.log(`[EMAIL] Initializing Resend service`);
console.log(`[EMAIL] API Key configured: ${RESEND_API_KEY ? "YES" : "NO"}`);
console.log(`[EMAIL] From: ${FROM_EMAIL}`);

const resend = new Resend(RESEND_API_KEY);

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export async function sendEmail(options: SendEmailOptions): Promise<boolean> {
  try {
    if (!RESEND_API_KEY) {
      console.error("[EMAIL] RESEND_API_KEY not configured");
      return false;
    }

    console.log(`[EMAIL] Attempting to send email to ${options.to}`);

    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text || options.html.replace(/<[^>]*>/g, ""),
    });

    if (error) {
      console.error("[EMAIL] Resend error:", error);
      return false;
    }

    console.log(`[EMAIL] Email sent successfully to ${options.to}`, data?.id);
    return true;
  } catch (error: any) {
    console.error("[EMAIL] Error sending email:", error?.message || error);
    return false;
  }
}

export async function sendPasswordResetEmail(
  email: string,
  resetCode: string,
  userName: string
): Promise<boolean> {
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
              <h2 style="color: #1f2937; margin: 0 0 16px; font-size: 24px;">Ola, ${userName || "Usuario"}!</h2>

              <p style="color: #4b5563; font-size: 16px; line-height: 24px; margin: 0 0 24px;">
                Recebemos uma solicitacao para redefinir a senha da sua conta no ${APP_NAME}.
              </p>

              <p style="color: #4b5563; font-size: 16px; line-height: 24px; margin: 0 0 32px;">
                Use o codigo abaixo para redefinir sua senha:
              </p>

              <!-- Code Box -->
              <div style="background-color: #f3f4f6; border-radius: 12px; padding: 24px; text-align: center; margin-bottom: 32px;">
                <span style="font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #0d9488;">${resetCode}</span>
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
    subject: `Codigo de recuperacao: ${resetCode} - ${APP_NAME}`,
    html,
  });
}

export async function verifyEmailConnection(): Promise<boolean> {
  if (!RESEND_API_KEY) {
    console.error("[EMAIL] RESEND_API_KEY not configured");
    return false;
  }
  console.log("[EMAIL] Resend service ready");
  return true;
}
