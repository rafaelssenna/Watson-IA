// Uazapi Service - Send messages via WhatsApp

const UAZAPI_BASE_URL = process.env.UAZAPI_BASE_URL || "https://hia-clientes.uazapi.com";

export interface SendMessageResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

// Send a text message via Uazapi
export async function sendTextMessage(
  instanceToken: string,
  phone: string,
  text: string
): Promise<SendMessageResult> {
  try {
    console.log(`[uazapi.sendTextMessage] Sending to ${phone}: ${text.substring(0, 50)}...`);

    const response = await fetch(`${UAZAPI_BASE_URL}/send/text`, {
      method: "POST",
      headers: {
        token: instanceToken,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        number: phone.replace(/\D/g, ""), // Clean phone number
        text: text,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[uazapi.sendTextMessage] Failed: ${response.status} - ${errorText}`);
      return { success: false, error: errorText };
    }

    const data = await response.json() as { messageId?: string; id?: string; key?: { id?: string } };
    console.log(`[uazapi.sendTextMessage] Success:`, data);

    return {
      success: true,
      messageId: data.messageId || data.id || data.key?.id,
    };
  } catch (error) {
    console.error("[uazapi.sendTextMessage] Exception:", error);
    return { success: false, error: String(error) };
  }
}
