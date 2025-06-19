import { nanoid } from 'nanoid'
import type { WebSocket } from 'ws'
import type { WsUrlShortenedMessage } from '../../types/api.types.js'
import { WsMessageType } from '../../types/api.types.js'
import type { PendingMessage } from '../../types/websocket.types.js'

/**
 * Handles WebSocket message sending and management
 */
export class MessageHandler {
  private pendingMessages: PendingMessage[] = []

  /**
   * Sends a shortened URL message to the client
   */
  sendShortenedUrl(client: WebSocket, shortenedUrl: string): void {
    const messageId = nanoid()
    const message: WsUrlShortenedMessage = {
      type: WsMessageType.URL_SHORTENED,
      messageId,
      data: { shortenedURL: shortenedUrl },
    }

    const pendingMessage: PendingMessage = {
      id: messageId,
      data: { shortenedURL: shortenedUrl },
      attempts: 1,
      lastAttempt: new Date(),
    }

    this.pendingMessages.push(pendingMessage)

    try {
      client.send(JSON.stringify(message))
    } catch (error) {
      console.error('Failed to send message to client:', error)
    }
  }

  /**
   * Handles message acknowledgment from client
   */
  handleAcknowledgment(messageId: string): void {
    this.pendingMessages = this.pendingMessages.filter((msg) => msg.id !== messageId)
    console.log(`Acknowledgment received for message ${messageId}`)
  }

  /**
   * Gets pending messages for retry processing
   */
  getPendingMessages(): PendingMessage[] {
    return this.pendingMessages
  }

  /**
   * Updates pending messages after retry processing
   */
  setPendingMessages(messages: PendingMessage[]): void {
    this.pendingMessages = messages
  }

  /**
   * Clears all pending messages
   */
  clearPendingMessages(): void {
    this.pendingMessages = []
  }
}
