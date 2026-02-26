// Email Service using Zoho SMTP
import nodemailer from "nodemailer";

const ZOHO_EMAIL = process.env.ZOHO_EMAIL || "engenharia@helsenia.com.br";
const ZOHO_PASSWORD = process.env.ZOHO_PASSWORD || "";
const APP_NAME = "Watson IA";

// Custom domain = smtppro.zoho.com | Personal (@zoho.com) = smtp.zoho.com
const ZOHO_HOST = process.env.ZOHO_HOST || "smtppro.zoho.com";
const ZOHO_PORT = Number(process.env.ZOHO_PORT) || 465;

console.log(`[EMAIL] ========================================`);
console.log(`[EMAIL] Host: ${ZOHO_HOST}`);
console.log(`[EMAIL] Port: ${ZOHO_PORT}`);
console.log(`[EMAIL] Account: ${ZOHO_EMAIL}`);
console.log(`[EMAIL] Password: ${ZOHO_PASSWORD ? "YES (" + ZOHO_PASSWORD.length + " chars)" : "NOT SET"}`);
console.log(`[EMAIL] ========================================`);

const transporter = nodemailer.createTransport({
  host: ZOHO_HOST,
  port: ZOHO_PORT,
  secure: ZOHO_PORT === 465,
  auth: {
    user: ZOHO_EMAIL,
    pass: ZOHO_PASSWORD,
  },
  tls: {
    rejectUnauthorized: false,
  },
  connectionTimeout: 15000,
  greetingTimeout: 15000,
  socketTimeout: 15000,
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
      console.error("[EMAIL] ZOHO_PASSWORD not configured!");
      return false;
    }

    console.log(`[EMAIL] Sending to: ${options.to}`);
    console.log(`[EMAIL] Subject: ${options.subject}`);

    const result = await transporter.sendMail({
      from: `"${APP_NAME}" <${ZOHO_EMAIL}>`,
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text || options.html.replace(/<[^>]*>/g, ""),
    });

    console.log(`[EMAIL] SUCCESS! MessageId: ${result.messageId}`);
    console.log(`[EMAIL] Response: ${result.response}`);
    return true;
  } catch (error: any) {
    console.error(`[EMAIL] FAILED!`);
    console.error(`[EMAIL] Error code: ${error?.code}`);
    console.error(`[EMAIL] Error message: ${error?.message}`);
    console.error(`[EMAIL] Error command: ${error?.command}`);
    if (error?.responseCode) console.error(`[EMAIL] Response code: ${error.responseCode}`);
    if (error?.response) console.error(`[EMAIL] Response: ${error.response}`);
    return false;
  }
}

export async function testEmailConnection(): Promise<{
  success: boolean;
  message: string;
  details: Record<string, any>;
}> {
  const details: Record<string, any> = {
    host: ZOHO_HOST,
    port: ZOHO_PORT,
    email: ZOHO_EMAIL,
    passwordSet: !!ZOHO_PASSWORD,
    passwordLength: ZOHO_PASSWORD.length,
  };

  if (!ZOHO_PASSWORD) {
    return {
      success: false,
      message: "ZOHO_PASSWORD not configured",
      details,
    };
  }

  try {
    console.log("[EMAIL] Testing SMTP connection...");
    await transporter.verify();
    console.log("[EMAIL] SMTP connection verified OK!");
    return {
      success: true,
      message: "SMTP connection OK",
      details: { ...details, verified: true },
    };
  } catch (error: any) {
    console.error("[EMAIL] SMTP verify failed:", error.message);
    return {
      success: false,
      message: error.message,
      details: {
        ...details,
        errorCode: error.code,
        errorCommand: error.command,
        responseCode: error.responseCode,
        response: error.response,
      },
    };
  }
}

export async function sendTestEmail(to: string): Promise<boolean> {
  return sendEmail({
    to,
    subject: `Teste de Email - ${APP_NAME}`,
    html: `
      <div style="padding: 20px; font-family: Arial, sans-serif;">
        <h2 style="color: #0d9488;">Watson IA - Email Funcionando!</h2>
        <p>Se voce recebeu este email, o sistema de email esta configurado corretamente.</p>
        <p style="color: #6b7280; font-size: 12px;">Enviado em: ${new Date().toISOString()}</p>
      </div>
    `,
  });
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
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; background-color: #f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
    <tr>
      <td>
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <tr>
            <td style="background: linear-gradient(135deg, #0d9488 0%, #0891b2 100%); padding: 32px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: bold;">${APP_NAME}</h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 40px 32px;">
              <h2 style="color: #1f2937; margin: 0 0 16px; font-size: 24px;">Ola, ${userName || "Usuario"}!</h2>
              <p style="color: #4b5563; font-size: 16px; line-height: 24px; margin: 0 0 32px;">
                Use o codigo abaixo para redefinir sua senha:
              </p>
              <div style="background-color: #f3f4f6; border-radius: 12px; padding: 24px; text-align: center; margin-bottom: 32px;">
                <span style="font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #0d9488;">${resetCode}</span>
              </div>
              <p style="color: #6b7280; font-size: 14px;">Este codigo expira em <strong>1 hora</strong>.</p>
              <p style="color: #6b7280; font-size: 14px;">Se voce nao solicitou, ignore este email.</p>
            </td>
          </tr>
          <tr>
            <td style="background-color: #f9fafb; padding: 24px 32px; text-align: center; border-top: 1px solid #e5e7eb;">
              <p style="color: #9ca3af; font-size: 12px; margin: 0;">${APP_NAME} - Atendimento inteligente por WhatsApp</p>
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
