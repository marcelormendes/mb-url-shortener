import { nanoid } from 'nanoid'
import type { WebSocket } from 'ws'
import type { ClientConnection, ClientRegistry } from '../../types/websocket.types.js'

/**
 * Manages multiple WebSocket client connections
 */
export class MultiClientManager {
  private clients: ClientRegistry = {}
  private heartbeatInterval: NodeJS.Timeout | null = null
  private readonly HEARTBEAT_INTERVAL = 30000 // 30 seconds

  constructor() {
    this.startHeartbeat()
  }

  /**
   * Adds a new client connection
   */
  addClient(websocket: WebSocket): string {
    const clientId = nanoid()
    const connection: ClientConnection = {
      id: clientId,
      websocket,
      connectedAt: new Date(),
      lastActivity: new Date(),
    }

    this.clients[clientId] = connection
    console.log(`Client ${clientId} connected. Total clients: ${this.getClientCount()}`)
    return clientId
  }

  /**
   * Removes a client connection
   */
  removeClient(clientId: string): void {
    if (this.clients[clientId]) {
      delete this.clients[clientId]
      console.log(`Client ${clientId} disconnected. Total clients: ${this.getClientCount()}`)
    }
  }

  /**
   * Gets a client connection by ID
   */
  getClient(clientId: string): ClientConnection | null {
    return this.clients[clientId] || null
  }

  /**
   * Gets all active client connections
   */
  getAllClients(): ClientConnection[] {
    return Object.values(this.clients)
  }

  /**
   * Gets the count of active clients
   */
  getClientCount(): number {
    return Object.keys(this.clients).length
  }

  /**
   * Updates client activity timestamp
   */
  updateClientActivity(clientId: string): void {
    const client = this.clients[clientId]
    if (client) {
      client.lastActivity = new Date()
    }
  }

  /**
   * Checks if a client exists and is connected
   */
  hasClient(clientId: string): boolean {
    const client = this.clients[clientId]
    return !!(client && client.websocket.readyState === client.websocket.OPEN)
  }

  /**
   * Sends a message to a specific client
   */
  sendToClient(clientId: string, message: string): boolean {
    const client = this.clients[clientId]
    if (!client || client.websocket.readyState !== client.websocket.OPEN) {
      return false
    }

    try {
      client.websocket.send(message)
      this.updateClientActivity(clientId)
      return true
    } catch (error) {
      console.error(`Failed to send message to client ${clientId}:`, error)
      this.removeClient(clientId)
      return false
    }
  }

  /**
   * Broadcasts a message to all connected clients
   */
  broadcastToAll(message: string): void {
    const clients = this.getAllClients()
    clients.forEach((client) => {
      this.sendToClient(client.id, message)
    })
  }

  /**
   * Starts heartbeat mechanism to detect disconnected clients
   */
  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      const now = new Date()
      const staleClients: string[] = []

      Object.values(this.clients).forEach((client) => {
        if (client.websocket.readyState !== client.websocket.OPEN) {
          staleClients.push(client.id)
        } else {
          // Check for inactive clients (no activity for 5 minutes)
          const inactiveTime = now.getTime() - client.lastActivity.getTime()
          if (inactiveTime > 300000) {
            // 5 minutes
            try {
              client.websocket.ping()
              this.updateClientActivity(client.id)
            } catch (error) {
              console.error(`Ping failed for client ${client.id}:`, error)
              staleClients.push(client.id)
            }
          }
        }
      })

      // Remove stale clients
      staleClients.forEach((clientId) => {
        this.removeClient(clientId)
      })
    }, this.HEARTBEAT_INTERVAL)
  }

  /**
   * Stops heartbeat mechanism
   */
  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval)
      this.heartbeatInterval = null
    }
  }

  /**
   * Closes all client connections and cleanup
   */
  closeAll(): void {
    Object.values(this.clients).forEach((client) => {
      try {
        client.websocket.terminate()
      } catch (error) {
        console.error(`Error terminating client ${client.id}:`, error)
      }
    })
    this.clients = {}
    this.stopHeartbeat()
  }
}
