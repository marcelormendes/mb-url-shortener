import WebSocket from 'ws'
import supertest from 'supertest'
import { TestServer } from '../helpers/test-server'
import { WsMessageType } from '../../src/types/api.types'

describe('WebSocket E2E Tests', () => {
  let testServer: TestServer
  let request: ReturnType<typeof supertest>

  // Helper function to properly close WebSocket and wait for completion
  const closeWebSocket = (ws: WebSocket): Promise<void> => {
    if (ws.readyState === WebSocket.CLOSED) {
      return Promise.resolve()
    }

    return new Promise<void>((resolve) => {
      ws.on('close', () => resolve())
      ws.close()
    })
  }

  beforeAll(async () => {
    testServer = new TestServer()
    await testServer.start()
    if (!testServer.app) {
      throw new Error('Failed to start test server')
    }
    request = supertest(testServer.app.server)
  }, 30000)

  afterAll(async () => {
    await testServer.stop()
  }, 30000)

  describe('WebSocket Connection Management', () => {
    it('should establish WebSocket connection successfully', async () => {
      const ws = new WebSocket(testServer.getWsUrl())

      const connectionPromise = new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Connection timeout'))
        }, 5000)

        ws.on('open', () => {
          clearTimeout(timeout)
          resolve()
        })

        ws.on('error', (error) => {
          clearTimeout(timeout)
          reject(error)
        })
      })

      await connectionPromise

      expect(ws.readyState).toBe(WebSocket.OPEN)
      await closeWebSocket(ws)
    })

    it('should handle WebSocket disconnection gracefully', async () => {
      const ws = new WebSocket(testServer.getWsUrl())

      await new Promise<void>((resolve) => {
        ws.on('open', () => resolve())
      })

      await closeWebSocket(ws)
      expect(ws.readyState).toBe(WebSocket.CLOSED)
    })
  })

  describe('Error Scenarios', () => {
    it('should handle WebSocket errors during message sending', async () => {
      const testUrl = 'https://example.com/error-test'
      const ws = new WebSocket(testServer.getWsUrl())

      // Wait for connection to establish
      await new Promise<void>((resolve) => {
        ws.on('open', () => resolve())
      })

      // Close the WebSocket connection immediately
      await closeWebSocket(ws)

      // Make POST request - should not crash the server even though WebSocket is closed
      const response = await request.post('/url').send({ url: testUrl }).expect(200)

      expect(response.body).toEqual({
        message: 'URL shortened successfully. Result will be sent via WebSocket.',
      })
    })

    it('should handle malformed WebSocket messages', async () => {
      const ws = new WebSocket(testServer.getWsUrl())

      await new Promise<void>((resolve) => {
        ws.on('open', () => resolve())
      })

      // Send various malformed messages
      const malformedMessages = [
        '', // Empty string
        'not json',
        '{"incomplete": json',
        '{}', // Empty object
        '{"type": "UNKNOWN_TYPE"}', // Unknown message type
        '{"type": "ACKNOWLEDGMENT"}', // Missing messageId
        JSON.stringify({ type: WsMessageType.ACKNOWLEDGMENT, messageId: null }),
      ]

      for (const message of malformedMessages) {
        ws.send(message)
        // Wait a bit between messages
        await new Promise((resolve) => setTimeout(resolve, 100))
      }

      // Connection should still be open and functional
      expect(ws.readyState).toBe(WebSocket.OPEN)

      await closeWebSocket(ws)
    })
  })
})
