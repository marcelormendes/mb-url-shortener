import { WebSocketServer } from 'ws'
import { env } from '../../config/env.js'
import { ConnectionHandler } from './connection.handler.js'
import { MessageHandler } from './message.handler.js'
import { RetryHandler } from './retry.handler.js'

/**
 * Manages WebSocket connections and message delivery for multiple clients
 */
export class WebSocketManagerService {
  private wss: WebSocketServer
  private connectionHandler: ConnectionHandler
  private messageHandler: MessageHandler
  private retryHandler: RetryHandler
  private clientSessionMap: Map<string, string> = new Map() // Maps session IDs to client IDs

  constructor(port?: number) {
    this.wss = new WebSocketServer({ port: port ?? env.WS_PORT })
    this.connectionHandler = new ConnectionHandler()
    this.messageHandler = new MessageHandler(this.connectionHandler.getClientManager())
    this.retryHandler = new RetryHandler()

    this.setupWebSocketServer()
    this.startRetryMechanism()
  }

  /**
   * Wait for WebSocket server to be ready
   */
  async waitForReady(): Promise<void> {
    return new Promise<void>((resolve) => {
      // WebSocket server starts listening immediately, so we can resolve
      resolve()
    })
  }

  /**
   * Sets up WebSocket server event handlers
   */
  private setupWebSocketServer(): void {
    this.wss.on('connection', (ws) => {
      const clientId = this.connectionHandler.handleConnection(ws, (messageId, clientId) => {
        this.messageHandler.handleAcknowledgment(messageId, clientId)
      })
      console.log(`New WebSocket client connected: ${clientId}`)
    })
  }

  /**
   * Associates a session ID with a client ID for targeted messaging
   */
  associateSession(sessionId: string, clientId: string): void {
    this.clientSessionMap.set(sessionId, clientId)
  }

  /**
   * Sends a shortened URL to a specific client by session ID
   */
  sendShortenedUrlToSession(sessionId: string | null, shortenedUrl: string): boolean {
    if (!sessionId) {
      // Fallback: send to any available client for backward compatibility
      const clientManager = this.connectionHandler.getClientManager()
      const allClients = clientManager.getAllClients()
      if (allClients.length > 0) {
        return this.sendShortenedUrlToClient(allClients[0].id, shortenedUrl)
      }
      return false
    }

    const clientId = this.clientSessionMap.get(sessionId)
    if (!clientId) {
      console.warn(`No client ID found for session ${sessionId}`)
      return false
    }

    return this.sendShortenedUrlToClient(clientId, shortenedUrl)
  }

  /**
   * Sends a shortened URL to a specific client by client ID
   */
  sendShortenedUrlToClient(clientId: string, shortenedUrl: string): boolean {
    const clientManager = this.connectionHandler.getClientManager()
    if (!clientManager.hasClient(clientId)) {
      console.warn(`Client ${clientId} not found or disconnected`)
      return false
    }

    this.messageHandler.sendShortenedUrl(clientId, shortenedUrl)
    return true
  }

  /**
   * Starts the retry mechanism for pending messages
   */
  private startRetryMechanism(): void {
    this.retryHandler.start(() => {
      const clientManager = this.connectionHandler.getClientManager()
      const pendingMessages = this.messageHandler.getPendingMessages()
      const updatedMessages = this.retryHandler.processPendingMessages(
        clientManager,
        pendingMessages,
      )
      this.messageHandler.setPendingMessages(updatedMessages)
    })
  }

  /**
   * Gets the count of connected clients
   */
  getConnectedClientCount(): number {
    return this.connectionHandler.getConnectedClientCount()
  }

  /**
   * Gets statistics about connections and pending messages
   */
  getStats(): {
    connectedClients: number
    pendingMessages: number
    activeSessions: number
  } {
    return {
      connectedClients: this.connectionHandler.getConnectedClientCount(),
      pendingMessages: this.messageHandler.getPendingMessages().length,
      activeSessions: this.clientSessionMap.size,
    }
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
   * Closes the WebSocket server and cleans up all resources
   */
  async close(): Promise<void> {
    // Stop retry mechanism
    this.retryHandler.stop()

    // Close all client connections
    this.connectionHandler.closeAllClients()

    // Clear pending messages and session mappings
    this.messageHandler.clearPendingMessages()
    this.clientSessionMap.clear()

    // Close the WebSocket server
    return new Promise((resolve) => {
      this.wss.close(() => {
        // Small delay to ensure all cleanup is complete
        setTimeout(resolve, 10)
      })
    })
  }
}
