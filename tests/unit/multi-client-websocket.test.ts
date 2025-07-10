import { WebSocketServer } from 'ws'
import { MultiClientManager } from '../../src/services/websocket/multi-client-manager.service.js'
import { ConnectionHandler } from '../../src/services/websocket/connection.handler.js'
import { MessageHandler } from '../../src/services/websocket/message.handler.js'
import { WebSocketManagerService } from '../../src/services/websocket/websocket-manager.service.js'
import WebSocket from 'ws'

describe('Multi-Client WebSocket Implementation', () => {
  let wsManager: WebSocketManagerService
  let wsPort: number

  beforeEach(() => {
    wsPort = 3002 + Math.floor(Math.random() * 1000)
    wsManager = new WebSocketManagerService(wsPort)
  })

  afterEach(async () => {
    await wsManager.close()
  })

  describe('MultiClientManager', () => {
    let clientManager: MultiClientManager
    let mockWebSocket: WebSocket

    beforeEach(() => {
      clientManager = new MultiClientManager()
      mockWebSocket = {
        readyState: WebSocket.OPEN,
        send: jest.fn(),
        ping: jest.fn(),
        terminate: jest.fn(),
        OPEN: WebSocket.OPEN,
      } as any
    })

    afterEach(() => {
      clientManager.closeAll()
    })

    it('should add and track multiple clients', () => {
      const client1Id = clientManager.addClient(mockWebSocket)
      const client2Id = clientManager.addClient(mockWebSocket)

      expect(client1Id).toBeDefined()
      expect(client2Id).toBeDefined()
      expect(client1Id).not.toBe(client2Id)
      expect(clientManager.getClientCount()).toBe(2)
    })

    it('should remove clients correctly', () => {
      const clientId = clientManager.addClient(mockWebSocket)
      expect(clientManager.getClientCount()).toBe(1)

      clientManager.removeClient(clientId)
      expect(clientManager.getClientCount()).toBe(0)
      expect(clientManager.getClient(clientId)).toBeNull()
    })

    it('should check client existence', () => {
      const clientId = clientManager.addClient(mockWebSocket)
      expect(clientManager.hasClient(clientId)).toBe(true)

      clientManager.removeClient(clientId)
      expect(clientManager.hasClient(clientId)).toBe(false)
    })

    it('should send message to specific client', () => {
      const clientId = clientManager.addClient(mockWebSocket)
      const message = JSON.stringify({ test: 'message' })

      const result = clientManager.sendToClient(clientId, message)
      expect(result).toBe(true)
      expect(mockWebSocket.send).toHaveBeenCalledWith(message)
    })

    it('should return false when sending to non-existent client', () => {
      const result = clientManager.sendToClient('non-existent', 'message')
      expect(result).toBe(false)
    })

    it('should broadcast to all clients', () => {
      const mockWs1 = { ...mockWebSocket, send: jest.fn() }
      const mockWs2 = { ...mockWebSocket, send: jest.fn() }

      clientManager.addClient(mockWs1 as any)
      clientManager.addClient(mockWs2 as any)

      const message = 'broadcast message'
      clientManager.broadcastToAll(message)

      expect(mockWs1.send).toHaveBeenCalledWith(message)
      expect(mockWs2.send).toHaveBeenCalledWith(message)
    })
  })

  describe('Connection Handler', () => {
    let connectionHandler: ConnectionHandler
    let mockWebSocket: WebSocket

    beforeEach(() => {
      connectionHandler = new ConnectionHandler()
      mockWebSocket = {
        on: jest.fn(),
        readyState: WebSocket.OPEN,
        OPEN: WebSocket.OPEN,
      } as any
    })

    afterEach(() => {
      connectionHandler.closeAllClients()
    })

    it('should handle new connection and return client ID', () => {
      const onMessage = jest.fn()
      const clientId = connectionHandler.handleConnection(mockWebSocket, onMessage)

      expect(clientId).toBeDefined()
      expect(typeof clientId).toBe('string')
      expect(connectionHandler.getConnectedClientCount()).toBe(1)
    })

    it('should set up WebSocket event listeners', () => {
      const onMessage = jest.fn()
      connectionHandler.handleConnection(mockWebSocket, onMessage)

      expect(mockWebSocket.on).toHaveBeenCalledWith('message', expect.any(Function))
      expect(mockWebSocket.on).toHaveBeenCalledWith('close', expect.any(Function))
      expect(mockWebSocket.on).toHaveBeenCalledWith('error', expect.any(Function))
      expect(mockWebSocket.on).toHaveBeenCalledWith('pong', expect.any(Function))
    })

    it('should support multiple concurrent connections', () => {
      const mockWs1 = { ...mockWebSocket, on: jest.fn() }
      const mockWs2 = { ...mockWebSocket, on: jest.fn() }

      const clientId1 = connectionHandler.handleConnection(mockWs1 as any, jest.fn())
      const clientId2 = connectionHandler.handleConnection(mockWs2 as any, jest.fn())

      expect(clientId1).not.toBe(clientId2)
      expect(connectionHandler.getConnectedClientCount()).toBe(2)
    })
  })

  describe('Message Handler', () => {
    let messageHandler: MessageHandler
    let clientManager: MultiClientManager
    let mockWebSocket: WebSocket

    beforeEach(() => {
      clientManager = new MultiClientManager()
      messageHandler = new MessageHandler(clientManager)
      mockWebSocket = {
        readyState: WebSocket.OPEN,
        send: jest.fn(),
        OPEN: WebSocket.OPEN,
      } as any
    })

    afterEach(() => {
      clientManager.closeAll()
    })

    it('should send message to specific client', () => {
      const clientId = clientManager.addClient(mockWebSocket)
      const shortenedUrl = 'http://short.ly/abc123'

      messageHandler.sendShortenedUrl(clientId, shortenedUrl)

      expect(mockWebSocket.send).toHaveBeenCalledWith(expect.stringContaining(shortenedUrl))
    })

    it('should track pending messages with client ID', () => {
      const clientId = clientManager.addClient(mockWebSocket)
      const shortenedUrl = 'http://short.ly/abc123'

      messageHandler.sendShortenedUrl(clientId, shortenedUrl)

      const pendingMessages = messageHandler.getPendingMessages()
      expect(pendingMessages).toHaveLength(1)
      expect(pendingMessages[0].clientId).toBe(clientId)
      expect(pendingMessages[0].data.shortenedURL).toBe(shortenedUrl)
    })

    it('should handle acknowledgment correctly', () => {
      const clientId = clientManager.addClient(mockWebSocket)
      messageHandler.sendShortenedUrl(clientId, 'http://short.ly/abc123')

      const pendingMessages = messageHandler.getPendingMessages()
      expect(pendingMessages).toHaveLength(1)

      const messageId = pendingMessages[0].id
      messageHandler.handleAcknowledgment(messageId, clientId)

      expect(messageHandler.getPendingMessages()).toHaveLength(0)
    })
  })

  describe('WebSocket Manager Service', () => {
    it('should support multiple concurrent connections', (done: any) => {
      const clients: WebSocket[] = []
      const clientIds: string[] = []

      // Create multiple WebSocket connections
      for (let i = 0; i < 3; i++) {
        const ws = new WebSocket(`ws://localhost:${wsPort}`)
        clients.push(ws)

        ws.on('open', () => {
          // Register each connection with a session
          const sessionId = `session-${i}`
          const clientId = `client-${i}`

          fetch(`http://localhost:3000/ws/register-session`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionId, clientId }),
          }).catch(() => {
            // Registration endpoint might not be available in test
          })

          clientIds.push(clientId)

          if (clients.length === 3 && clients.every((c) => c.readyState === WebSocket.OPEN)) {
            expect(wsManager.getConnectedClientCount()).toBe(3)

            // Cleanup
            clients.forEach((c) => c.close())
            done()
          }
        })

        ws.on('error', (error) => {
          console.error('WebSocket error:', error)
        })
      }
    })

    it('should maintain connection statistics', async () => {
      const stats = wsManager.getStats()
      expect(stats).toHaveProperty('connectedClients')
      expect(stats).toHaveProperty('pendingMessages')
      expect(stats).toHaveProperty('activeSessions')
      expect(typeof stats.connectedClients).toBe('number')
      expect(typeof stats.pendingMessages).toBe('number')
      expect(typeof stats.activeSessions).toBe('number')
    })

    it('should handle session association', () => {
      const sessionId = 'test-session'
      const clientId = 'test-client'

      wsManager.associateSession(sessionId, clientId)

      const stats = wsManager.getStats()
      expect(stats.activeSessions).toBe(1)
    })
  })

  describe('Integration Tests', () => {
    it('should handle complete multi-client workflow', (done: any) => {
      const client1 = new WebSocket(`ws://localhost:${wsPort}`)
      const client2 = new WebSocket(`ws://localhost:${wsPort}`)

      let client1Ready = false
      let client2Ready = false

      client1.on('open', () => {
        client1Ready = true
        checkBothReady()
      })

      client2.on('open', () => {
        client2Ready = true
        checkBothReady()
      })

      function checkBothReady() {
        if (client1Ready && client2Ready) {
          expect(wsManager.getConnectedClientCount()).toBe(2)

          // Test that both clients remain connected
          setTimeout(() => {
            expect(wsManager.getConnectedClientCount()).toBe(2)
            client1.close()
            client2.close()
            done()
          }, 100)
        }
      }

      client1.on('error', done)
      client2.on('error', done)
    })
  })
})
