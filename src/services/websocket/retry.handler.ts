import type { WebSocket } from 'ws'
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
   * Processes pending messages for retry
   */
  processPendingMessages(
    client: WebSocket | null,
    pendingMessages: PendingMessage[],
  ): PendingMessage[] {
    if (!client) {
      return pendingMessages
    }

    const now = new Date()
    return pendingMessages.filter((msg) => {
      if (msg.attempts >= this.config.maxAttempts) {
        console.error(`Message ${msg.id} failed after ${this.config.maxAttempts} attempts`)
        return false
      }

      const timeSinceLastAttempt = now.getTime() - msg.lastAttempt.getTime()
      if (timeSinceLastAttempt < this.config.retryDelay) {
        return true
      }

      try {
        const message: WsUrlShortenedMessage = {
          type: WsMessageType.URL_SHORTENED,
          messageId: msg.id,
          data: msg.data,
        }
        client.send(JSON.stringify(message))
        msg.attempts++
        msg.lastAttempt = now
        console.log(`Retrying message ${msg.id} (attempt ${msg.attempts})`)
      } catch (error) {
        if (error instanceof Error) {
          console.error(`Retry failed for message ${msg.id}:`, error.message)
        } else {
          console.error(`Retry failed for message ${msg.id}: Unknown error`)
        }
      }

      return true
    })
  }
}
