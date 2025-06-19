import { WebSocketServer } from 'ws'
import { nanoid } from 'nanoid'
import type { WsMessage, WsUrlShortenedMessage } from '../types/api.types.js'
import { WsMessageType } from '../types/api.types.js'
import { env } from '../config/env.js'

interface PendingMessage {
  id: string
  data: { shortenedURL: string }
  attempts: number
  lastAttempt: Date
}

/**
 * Manages WebSocket connections and message delivery for a single client
 */
export class WebSocketManagerService {
  private wss: WebSocketServer
  private currentClient: import('ws').WebSocket | null = null
  private pendingMessages: PendingMessage[] = []
  private retryInterval: NodeJS.Timeout | null = null

  constructor(port?: number) {
    this.wss = new WebSocketServer({ port: port ?? env.WS_PORT })
    this.setupWebSocketServer()
    this.startRetryMechanism()
  }

  /**
   * Sets up WebSocket server event handlers
   */
  private setupWebSocketServer(): void {
    this.wss.on('connection', (ws) => {
      // Only allow one client at a time
      if (this.currentClient) {
        console.log('New client connected, closing previous connection')
        this.currentClient.close()
      }

      this.currentClient = ws
      console.log('WebSocket client connected')

      ws.on('message', (data) => {
        try {
          // Convert Buffer to string for JSON parsing
          let rawData: string
          if (Buffer.isBuffer(data)) {
            rawData = data.toString('utf-8')
          } else if (Array.isArray(data)) {
            rawData = Buffer.concat(data).toString('utf-8')
          } else if (typeof data === 'string') {
            rawData = data
          } else {
            // Handle other data types by converting to string
            rawData = JSON.stringify(data)
          }

          const message = JSON.parse(rawData) as WsMessage
          if (message.type === WsMessageType.ACKNOWLEDGMENT) {
            this.handleAcknowledgment(message.messageId)
          }
        } catch (error) {
          console.error('Invalid WebSocket message:', error)
        }
      })

      ws.on('close', () => {
        console.log('WebSocket client disconnected')
        if (this.currentClient === ws) {
          this.currentClient = null
        }
      })

      ws.on('error', (error) => {
        console.error('WebSocket error:', error)
      })
    })
  }

  /**
   * Sends a shortened URL to the connected client
   */
  sendShortenedUrl(shortenedUrl: string): void {
    if (!this.currentClient) {
      console.warn('No WebSocket client connected. Cannot send shortened URL.')
      return
    }

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
      this.currentClient.send(JSON.stringify(message))
    } catch (error) {
      console.error('Failed to send message to client:', error)
    }
  }

  /**
   * Handles acknowledgment from client
   */
  private handleAcknowledgment(messageId: string): void {
    this.pendingMessages = this.pendingMessages.filter((msg) => msg.id !== messageId)
    console.log(`Acknowledgment received for message ${messageId}`)
  }

  /**
   * Starts the retry mechanism for pending messages
   */
  private startRetryMechanism(): void {
    this.retryInterval = setInterval(() => {
      this.retryPendingMessages()
    }, 5000)
  }

  /**
   * Retries sending pending messages
   */
  private retryPendingMessages(): void {
    if (!this.currentClient) {
      return
    }

    const maxAttempts = 5
    const retryDelay = 30000

    const now = new Date()
    this.pendingMessages = this.pendingMessages.filter((msg) => {
      if (msg.attempts >= maxAttempts) {
        console.error(`Message ${msg.id} failed after ${maxAttempts} attempts`)
        return false
      }

      const timeSinceLastAttempt = now.getTime() - msg.lastAttempt.getTime()
      if (timeSinceLastAttempt < retryDelay) {
        return true
      }

      try {
        const message: WsUrlShortenedMessage = {
          type: WsMessageType.URL_SHORTENED,
          messageId: msg.id,
          data: msg.data,
        }
        this.currentClient!.send(JSON.stringify(message))
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

  /**
   * Gets the port the WebSocket server is listening on
   */
  getPort(): number {
    const address = this.wss.address()
    if (typeof address === 'object' && address !== null) {
      return address.port
    }
    return env.WS_PORT
  }

  /**
   * Closes the WebSocket server
   */
  async close(): Promise<void> {
    // Clear the retry interval first
    if (this.retryInterval) {
      clearInterval(this.retryInterval)
      this.retryInterval = null
    }

    // Close current client connection
    if (this.currentClient) {
      this.currentClient.terminate()
      this.currentClient = null
    }

    // Clear pending messages
    this.pendingMessages = []

    // Close the WebSocket server
    return new Promise((resolve) => {
      this.wss.close(() => {
        // Small delay to ensure all cleanup is complete
        setTimeout(resolve, 10)
      })
    })
  }
}
