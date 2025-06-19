import type { WebSocket } from 'ws'
import type { WsMessage } from '../../types/api.types.js'
import { WsMessageType } from '../../types/api.types.js'

/**
 * Handles WebSocket connection events and message parsing
 */
export class ConnectionHandler {
  private currentClient: WebSocket | null = null

  /**
   * Handles new WebSocket connection
   */
  handleConnection(ws: WebSocket, onMessage: (messageId: string) => void): void {
    // Only allow one client at a time
    if (this.currentClient) {
      console.log('New client connected, closing previous connection')
      this.currentClient.close()
    }

    this.currentClient = ws
    console.log('WebSocket client connected')

    ws.on('message', (data) => {
      try {
        const rawData = this.parseMessageData(data)
        const message = JSON.parse(rawData) as WsMessage

        if (message.type === WsMessageType.ACKNOWLEDGMENT) {
          onMessage(message.messageId)
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
  }

  /**
   * Gets the current connected client
   */
  getCurrentClient(): WebSocket | null {
    return this.currentClient
  }

  /**
   * Closes the current client connection
   */
  closeCurrentClient(): void {
    if (this.currentClient) {
      this.currentClient.terminate()
      this.currentClient = null
    }
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
