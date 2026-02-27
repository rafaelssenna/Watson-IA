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

// Download media from a message (audio, image, video, etc.)
export async function downloadMedia(
  instanceToken: string,
  messageId: string
): Promise<{ base64Data: string; mimetype: string } | null> {
  try {
    const response = await fetch(`${UAZAPI_BASE_URL}/message/download`, {
      method: "POST",
      headers: {
        token: instanceToken,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        id: messageId,
        generate_mp3: true,
        return_base64: true,
        return_link: false,
      }),
    });

    if (!response.ok) {
      console.error(`[uazapi.downloadMedia] Failed: ${response.status}`);
      return null;
    }

    const data = await response.json() as { base64Data?: string; mimetype?: string };

    if (!data.base64Data || !data.mimetype) {
      console.error(`[uazapi.downloadMedia] No base64Data or mimetype. Response keys: ${Object.keys(data).join(", ")}. mimetype=${data.mimetype}`);
      return null;
    }

    return { base64Data: data.base64Data, mimetype: data.mimetype };
  } catch (error) {
    console.error("[uazapi.downloadMedia] Exception:", error);
    return null;
  }
}
