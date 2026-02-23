/**
 * Message Buffer Service
 *
 * Buffers incoming messages from the same conversation and groups them
 * before triggering AI response. This prevents the AI from responding
 * to each message individually when users send multiple quick messages.
 *
 * Example: User sends "Oi" / "Tudo bem?" / "Queria saber o preço"
 * Without buffer: 3 separate AI responses
 * With buffer: 1 AI response addressing all 3 messages
 */

interface BufferedMessage {
  content: string;
  messageId: string;
  timestamp: Date;
}

interface ConversationBuffer {
  messages: BufferedMessage[];
  timeout: NodeJS.Timeout | null;
  conversationData: {
    orgId: string;
    conversation: any;
    waId: string;
    contact: any;
  };
}

type ProcessCallback = (
  orgId: string,
  conversation: any,
  waId: string,
  combinedMessage: string
) => Promise<void>;

class MessageBufferService {
  private buffers: Map<string, ConversationBuffer> = new Map();

  // Default delay in milliseconds (3 seconds)
  private bufferDelayMs: number = 3000;

  // Callback to process buffered messages
  private processCallback: ProcessCallback | null = null;

  /**
   * Configure the buffer delay
   */
  setBufferDelay(delayMs: number) {
    this.bufferDelayMs = delayMs;
  }

  /**
   * Set the callback function to process buffered messages
   */
  setProcessCallback(callback: ProcessCallback) {
    this.processCallback = callback;
  }

  /**
   * Add a message to the buffer for a conversation
   * Returns true if this is a new buffer (first message)
   */
  addMessage(
    conversationId: string,
    message: BufferedMessage,
    conversationData: ConversationBuffer["conversationData"]
  ): boolean {
    const isNewBuffer = !this.buffers.has(conversationId);

    let buffer = this.buffers.get(conversationId);

    if (!buffer) {
      buffer = {
        messages: [],
        timeout: null,
        conversationData,
      };
      this.buffers.set(conversationId, buffer);
    }

    // Add message to buffer
    buffer.messages.push(message);

    // Clear existing timeout
    if (buffer.timeout) {
      clearTimeout(buffer.timeout);
    }

    // Set new timeout
    buffer.timeout = setTimeout(() => {
      this.flushBuffer(conversationId);
    }, this.bufferDelayMs);

    return isNewBuffer;
  }

  /**
   * Flush the buffer for a conversation and process all messages
   */
  private async flushBuffer(conversationId: string) {
    const buffer = this.buffers.get(conversationId);

    if (!buffer || buffer.messages.length === 0) {
      this.buffers.delete(conversationId);
      return;
    }

    // Clear timeout
    if (buffer.timeout) {
      clearTimeout(buffer.timeout);
    }

    // Combine all messages
    const combinedMessage = buffer.messages
      .map((m) => m.content)
      .join("\n");

    const { orgId, conversation, waId } = buffer.conversationData;

    // Clear buffer before processing (to allow new messages while processing)
    this.buffers.delete(conversationId);

    // Process the combined message
    if (this.processCallback) {
      try {
        await this.processCallback(orgId, conversation, waId, combinedMessage);
      } catch (error) {
        console.error("Error processing buffered messages:", error);
      }
    }
  }

  /**
   * Get the number of pending messages in a conversation's buffer
   */
  getPendingCount(conversationId: string): number {
    return this.buffers.get(conversationId)?.messages.length || 0;
  }

  /**
   * Check if a conversation has a pending buffer
   */
  hasPendingBuffer(conversationId: string): boolean {
    return this.buffers.has(conversationId);
  }

  /**
   * Force flush all buffers (useful for graceful shutdown)
   */
  async flushAll() {
    const conversationIds = Array.from(this.buffers.keys());
    for (const id of conversationIds) {
      await this.flushBuffer(id);
    }
  }

  /**
   * Cancel a buffer without processing (e.g., if conversation mode changes)
   */
  cancelBuffer(conversationId: string) {
    const buffer = this.buffers.get(conversationId);
    if (buffer?.timeout) {
      clearTimeout(buffer.timeout);
    }
    this.buffers.delete(conversationId);
  }

  /**
   * Get buffer stats for monitoring
   */
  getStats() {
    return {
      activeBuffers: this.buffers.size,
      bufferDelayMs: this.bufferDelayMs,
      conversations: Array.from(this.buffers.entries()).map(([id, buf]) => ({
        conversationId: id,
        messageCount: buf.messages.length,
        oldestMessage: buf.messages[0]?.timestamp,
      })),
    };
  }
}

// Singleton instance
export const messageBuffer = new MessageBufferService();

// Export types
export type { BufferedMessage, ConversationBuffer, ProcessCallback };
