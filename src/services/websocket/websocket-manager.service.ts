import { WebSocketServer } from 'ws'
import { env } from '../../config/env.js'
import { ConnectionHandler } from './connection.handler.js'
import { MessageHandler } from './message.handler.js'
import { RetryHandler } from './retry.handler.js'

/**
 * Manages WebSocket connections and message delivery for a single client
 */
export class WebSocketManagerService {
  private wss: WebSocketServer
  private connectionHandler: ConnectionHandler
  private messageHandler: MessageHandler
  private retryHandler: RetryHandler

  constructor(port?: number) {
    this.wss = new WebSocketServer({ port: port ?? env.WS_PORT })
    this.connectionHandler = new ConnectionHandler()
    this.messageHandler = new MessageHandler()
    this.retryHandler = new RetryHandler()

    this.setupWebSocketServer()
    this.startRetryMechanism()
  }

  /**
   * Sets up WebSocket server event handlers
   */
  private setupWebSocketServer(): void {
    this.wss.on('connection', (ws) => {
      this.connectionHandler.handleConnection(ws, (messageId) => {
        this.messageHandler.handleAcknowledgment(messageId)
      })
    })
  }

  /**
   * Sends a shortened URL to the connected client
   */
  sendShortenedUrl(shortenedUrl: string): void {
    const client = this.connectionHandler.getCurrentClient()
    if (!client) {
      console.warn('No WebSocket client connected. Cannot send shortened URL.')
      return
    }

    this.messageHandler.sendShortenedUrl(client, shortenedUrl)
  }

  /**
   * Starts the retry mechanism for pending messages
   */
  private startRetryMechanism(): void {
    this.retryHandler.start(() => {
      const client = this.connectionHandler.getCurrentClient()
      const pendingMessages = this.messageHandler.getPendingMessages()
      const updatedMessages = this.retryHandler.processPendingMessages(client, pendingMessages)
      this.messageHandler.setPendingMessages(updatedMessages)
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
    // Stop retry mechanism
    this.retryHandler.stop()

    // Close current client connection
    this.connectionHandler.closeCurrentClient()

    // Clear pending messages
    this.messageHandler.clearPendingMessages()

    // Close the WebSocket server
    return new Promise((resolve) => {
      this.wss.close(() => {
        // Small delay to ensure all cleanup is complete
        setTimeout(resolve, 10)
      })
    })
  }
}
