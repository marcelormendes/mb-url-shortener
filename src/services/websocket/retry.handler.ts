import type { WsUrlShortenedMessage } from '../../types/api.types.js'
import { WsMessageType } from '../../types/api.types.js'
import type { PendingMessage, RetryConfig } from '../../types/websocket.types.js'
import { DEFAULT_RETRY_CONFIG } from '../../types/websocket.types.js'

/**
 * Handles message retry logic for WebSocket communication
 */
export class RetryHandler {
  private retryInterval: NodeJS.Timeout | null = null
  private config: RetryConfig

  constructor(config: RetryConfig = DEFAULT_RETRY_CONFIG) {
    this.config = config
  }

  /**
   * Starts the retry mechanism
   */
  start(retryCallback: () => void): void {
    this.retryInterval = setInterval(retryCallback, this.config.checkInterval)
  }

  /**
   * Stops the retry mechanism
   */
  stop(): void {
    if (this.retryInterval) {
      clearInterval(this.retryInterval)
      this.retryInterval = null
    }
  }

  /**
   * Processes pending messages for retry with multi-client support
   */
  processPendingMessages(
    clientManager: import('./multi-client-manager.service.js').MultiClientManager,
    pendingMessages: PendingMessage[],
  ): PendingMessage[] {
    const now = new Date()
    return pendingMessages.filter((msg) => {
      if (msg.attempts >= this.config.maxAttempts) {
        console.error(
          `Message ${msg.id} for client ${msg.clientId} failed after ${this.config.maxAttempts} attempts`,
        )
        return false
      }

      const timeSinceLastAttempt = now.getTime() - msg.lastAttempt.getTime()
      if (timeSinceLastAttempt < this.config.retryDelay) {
        return true
      }

      // Check if client is still connected
      if (!clientManager.hasClient(msg.clientId)) {
        console.log(`Client ${msg.clientId} disconnected, removing message ${msg.id}`)
        return false
      }

      try {
        const message: WsUrlShortenedMessage = {
          type: WsMessageType.URL_SHORTENED,
          messageId: msg.id,
          data: msg.data,
        }
        const success = clientManager.sendToClient(msg.clientId, JSON.stringify(message))
        if (success) {
          msg.attempts++
          msg.lastAttempt = now
          console.log(
            `Retrying message ${msg.id} for client ${msg.clientId} (attempt ${msg.attempts})`,
          )
        } else {
          console.error(`Failed to retry message ${msg.id} for client ${msg.clientId}`)
          return false
        }
      } catch (error) {
        if (error instanceof Error) {
          console.error(
            `Retry failed for message ${msg.id} (client ${msg.clientId}):`,
            error.message,
          )
        } else {
          console.error(
            `Retry failed for message ${msg.id} (client ${msg.clientId}): Unknown error`,
          )
        }
      }

      return true
    })
  }
}
