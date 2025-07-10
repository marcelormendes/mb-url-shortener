import type { WebSocket } from 'ws'
import type { WsMessage } from '../../types/api.types.js'
import { WsMessageType } from '../../types/api.types.js'
import { MultiClientManager } from './multi-client-manager.service.js'

/**
 * Handles WebSocket connection events and message parsing for multiple clients
 */
export class ConnectionHandler {
  private clientManager: MultiClientManager

  constructor() {
    this.clientManager = new MultiClientManager()
  }

  /**
   * Handles new WebSocket connection
   */
  handleConnection(
    ws: WebSocket,
    onMessage: (messageId: string, clientId: string) => void,
  ): string {
    const clientId = this.clientManager.addClient(ws)

    ws.on('message', (data) => {
      try {
        const rawData = this.parseMessageData(data)
        const message = JSON.parse(rawData) as WsMessage

        if (message.type === WsMessageType.ACKNOWLEDGMENT) {
          onMessage(message.messageId, clientId)
        }

        // Update client activity on any message
        this.clientManager.updateClientActivity(clientId)
      } catch (error) {
        console.error(`Invalid WebSocket message from client ${clientId}:`, error)
      }
    })

    ws.on('close', () => {
      console.log(`WebSocket client ${clientId} disconnected`)
      this.clientManager.removeClient(clientId)
    })

    ws.on('error', (error) => {
      console.error(`WebSocket error from client ${clientId}:`, error)
      this.clientManager.removeClient(clientId)
    })

    ws.on('pong', () => {
      this.clientManager.updateClientActivity(clientId)
    })

    return clientId
  }

  /**
   * Gets the multi-client manager instance
   */
  getClientManager(): MultiClientManager {
    return this.clientManager
  }

  /**
   * Sends a message to a specific client
   */
  sendToClient(clientId: string, message: string): boolean {
    return this.clientManager.sendToClient(clientId, message)
  }

  /**
   * Gets the count of connected clients
   */
  getConnectedClientCount(): number {
    return this.clientManager.getClientCount()
  }

  /**
   * Closes all client connections
   */
  closeAllClients(): void {
    this.clientManager.closeAll()
  }

  /**
   * Parses incoming WebSocket message data
   */
  private parseMessageData(data: unknown): string {
    if (Buffer.isBuffer(data)) {
      return data.toString('utf-8')
    } else if (Array.isArray(data)) {
      return Buffer.concat(data).toString('utf-8')
    } else if (typeof data === 'string') {
      return data
    } else {
      // Handle other data types by converting to string
      return JSON.stringify(data)
    }
  }
}
