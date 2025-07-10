import { nanoid } from 'nanoid'
import type { WsUrlShortenedMessage } from '../../types/api.types.js'
import { WsMessageType } from '../../types/api.types.js'
import type { PendingMessage } from '../../types/websocket.types.js'
import type { MultiClientManager } from './multi-client-manager.service.js'

/**
 * Handles WebSocket message sending and management for multiple clients
 */
export class MessageHandler {
  private pendingMessages: PendingMessage[] = []
  private clientManager: MultiClientManager

  constructor(clientManager: MultiClientManager) {
    this.clientManager = clientManager
  }

  /**
   * Sends a shortened URL message to a specific client
   */
  sendShortenedUrl(clientId: string, shortenedUrl: string): void {
    const messageId = nanoid()
    const message: WsUrlShortenedMessage = {
      type: WsMessageType.URL_SHORTENED,
      messageId,
      data: { shortenedURL: shortenedUrl },
    }

    const pendingMessage: PendingMessage = {
      id: messageId,
      clientId,
      data: { shortenedURL: shortenedUrl },
      attempts: 1,
      lastAttempt: new Date(),
    }

    this.pendingMessages.push(pendingMessage)

    const success = this.clientManager.sendToClient(clientId, JSON.stringify(message))
    if (!success) {
      console.error(`Failed to send message to client ${clientId}`)
    }
  }

  /**
   * Handles message acknowledgment from client
   */
  handleAcknowledgment(messageId: string, clientId: string): void {
    this.pendingMessages = this.pendingMessages.filter((msg) => msg.id !== messageId)
    console.log(`Acknowledgment received for message ${messageId} from client ${clientId}`)
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
