// Email Service using Zoho Mail API (REST + OAuth)

const ZOHO_CLIENT_ID = process.env.ZOHO_CLIENT_ID || "";
const ZOHO_CLIENT_SECRET = process.env.ZOHO_CLIENT_SECRET || "";
const ZOHO_REFRESH_TOKEN = process.env.ZOHO_REFRESH_TOKEN || "";
const ZOHO_ACCOUNT_ID = process.env.ZOHO_ACCOUNT_ID || "";
const ZOHO_EMAIL = process.env.ZOHO_EMAIL || "engenharia@helsenia.com.br";
const APP_NAME = "Watson IA";

let cachedAccessToken = "";
let tokenExpiresAt = 0;

console.log(`[EMAIL] ========================================`);
console.log(`[EMAIL] Zoho Mail API (OAuth)`);
console.log(`[EMAIL] Client ID: ${ZOHO_CLIENT_ID ? "SET" : "NOT SET"}`);
console.log(`[EMAIL] Client Secret: ${ZOHO_CLIENT_SECRET ? "SET" : "NOT SET"}`);
console.log(`[EMAIL] Refresh Token: ${ZOHO_REFRESH_TOKEN ? "SET" : "NOT SET"}`);
console.log(`[EMAIL] Account ID: ${ZOHO_ACCOUNT_ID || "NOT SET"}`);
console.log(`[EMAIL] From: ${ZOHO_EMAIL}`);
console.log(`[EMAIL] ========================================`);

async function getAccessToken(): Promise<string> {
  // Return cached token if still valid
  if (cachedAccessToken && Date.now() < tokenExpiresAt) {
    return cachedAccessToken;
  }

  console.log("[EMAIL] Refreshing access token...");

  const params = new URLSearchParams({
    refresh_token: ZOHO_REFRESH_TOKEN,
    grant_type: "refresh_token",
    client_id: ZOHO_CLIENT_ID,
    client_secret: ZOHO_CLIENT_SECRET,
  });

  const response = await fetch(`https://accounts.zoho.com/oauth/v2/token?${params.toString()}`, {
    method: "POST",
  });

  const data = await response.json() as any;

  if (data.error) {
    console.error("[EMAIL] Token refresh error:", data.error);
    throw new Error(`Zoho OAuth error: ${data.error}`);
  }

  cachedAccessToken = data.access_token;
  // Expire 5 min before actual expiry
  tokenExpiresAt = Date.now() + (data.expires_in - 300) * 1000;

  console.log("[EMAIL] Access token refreshed OK");
  return cachedAccessToken;
}

// Get Zoho Mail account ID automatically
async function getAccountId(): Promise<string> {
  if (ZOHO_ACCOUNT_ID) return ZOHO_ACCOUNT_ID;

  console.log("[EMAIL] Fetching account ID...");
  const token = await getAccessToken();

  const response = await fetch("https://mail.zoho.com/api/accounts", {
    headers: {
      Authorization: `Zoho-oauthtoken ${token}`,
      Accept: "application/json",
    },
  });

  const data = await response.json() as any;

  if (data.data && data.data.length > 0) {
    const accountId = data.data[0].accountId;
    console.log(`[EMAIL] Account ID found: ${accountId}`);
    return accountId;
  }

  throw new Error("No Zoho Mail accounts found");
}

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
}

export async function sendEmail(options: SendEmailOptions): Promise<boolean> {
  try {
    if (!ZOHO_CLIENT_ID || !ZOHO_CLIENT_SECRET || !ZOHO_REFRESH_TOKEN) {
      console.error("[EMAIL] Zoho OAuth credentials not configured!");
      return false;
    }

    console.log(`[EMAIL] Sending to: ${options.to}`);
    console.log(`[EMAIL] Subject: ${options.subject}`);

    const token = await getAccessToken();
    const accountId = await getAccountId();

    const response = await fetch(
      `https://mail.zoho.com/api/accounts/${accountId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Zoho-oauthtoken ${token}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          fromAddress: ZOHO_EMAIL,
          toAddress: options.to,
          subject: options.subject,
          content: options.html,
          mailFormat: "html",
        }),
      }
    );

    const data = await response.json() as any;

    if (data.status && data.status.code === 200) {
      console.log(`[EMAIL] SUCCESS! Email sent to ${options.to}`);
      return true;
    }

    console.error("[EMAIL] Send failed:", JSON.stringify(data));
    return false;
  } catch (error: any) {
    console.error(`[EMAIL] FAILED: ${error.message}`);
    return false;
  }
}

export async function testEmailConnection(): Promise<{
  success: boolean;
  message: string;
  details: Record<string, any>;
}> {
  const details: Record<string, any> = {
    clientId: ZOHO_CLIENT_ID ? "SET" : "NOT SET",
    clientSecret: ZOHO_CLIENT_SECRET ? "SET" : "NOT SET",
    refreshToken: ZOHO_REFRESH_TOKEN ? "SET" : "NOT SET",
    accountId: ZOHO_ACCOUNT_ID || "auto-detect",
    email: ZOHO_EMAIL,
  };

  if (!ZOHO_CLIENT_ID || !ZOHO_CLIENT_SECRET || !ZOHO_REFRESH_TOKEN) {
    return {
      success: false,
      message: "Missing Zoho OAuth credentials (ZOHO_CLIENT_ID, ZOHO_CLIENT_SECRET, ZOHO_REFRESH_TOKEN)",
      details,
    };
  }

  try {
    // Test token refresh
    console.log("[EMAIL] Testing OAuth token...");
    await getAccessToken();
    details.tokenOk = true;

    // Test account ID
    console.log("[EMAIL] Testing account access...");
    const accountId = await getAccountId();
    details.accountId = accountId;
    details.accountOk = true;

    return {
      success: true,
      message: "Zoho Mail API connection OK",
      details,
    };
  } catch (error: any) {
    return {
      success: false,
      message: error.message,
      details: { ...details, error: error.message },
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
        <p>Se voce recebeu este email, o sistema esta configurado corretamente.</p>
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
