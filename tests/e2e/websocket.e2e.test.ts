import WebSocket from 'ws'
import supertest from 'supertest'
import { TestServer } from '../helpers/test-server'
import { WsMessageType } from '../../src/types/api.types'
import type { WsMessage } from '../../src/types/api.types'

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

    it('should allow only one WebSocket connection at a time', async () => {
      const ws1 = new WebSocket(testServer.getWsUrl())
      const ws2 = new WebSocket(testServer.getWsUrl())

      // Wait for first connection to establish
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Connection 1 timeout'))
        }, 5000)

        ws1.on('open', () => {
          clearTimeout(timeout)
          resolve()
        })

        ws1.on('error', (error) => {
          clearTimeout(timeout)
          reject(error)
        })
      })

      expect(ws1.readyState).toBe(WebSocket.OPEN)

      // Wait for second connection to establish (should close first one)
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Connection 2 timeout'))
        }, 5000)

        ws2.on('open', () => {
          clearTimeout(timeout)
          resolve()
        })

        ws2.on('error', (error) => {
          clearTimeout(timeout)
          reject(error)
        })
      })

      expect(ws2.readyState).toBe(WebSocket.OPEN)

      // Give some time for the first connection to be closed by the server
      await new Promise((resolve) => setTimeout(resolve, 100))

      // First connection should be closed
      expect(ws1.readyState).toBe(WebSocket.CLOSED)

      await closeWebSocket(ws2)
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

  describe('Message Delivery and Acknowledgment', () => {
    it('should deliver shortened URL via WebSocket and handle acknowledgment', async () => {
      const testUrl = 'https://example.com/websocket-test'
      const ws = new WebSocket(testServer.getWsUrl())

      // Wait for connection to establish
      await new Promise<void>((resolve) => {
        ws.on('open', () => resolve())
      })

      let messageReceived = false
      let messageId: string | null = null

      const messagePromise = new Promise<string>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Message timeout'))
        }, 5000)

        ws.on('message', (data) => {
          try {
            const message = JSON.parse(data.toString()) as WsMessage

            if (message.type === WsMessageType.URL_SHORTENED) {
              messageReceived = true
              messageId = message.messageId
              clearTimeout(timeout)
              resolve(message.data.shortenedURL)
            }
          } catch (error) {
            clearTimeout(timeout)
            reject(error instanceof Error ? error : new Error(String(error)))
          }
        })
      })

      // Make POST request to trigger WebSocket message
      await request.post('/url').send({ url: testUrl }).expect(200)

      // Wait for WebSocket message
      const shortenedUrl = await messagePromise

      expect(messageReceived).toBe(true)
      expect(messageId).toBeDefined()
      expect(shortenedUrl).toMatch(/^http:\/\/(127\.0\.0\.1|localhost):\d+\/[a-zA-Z0-9]{10}$/)

      // Send acknowledgment
      ws.send(
        JSON.stringify({
          type: WsMessageType.ACKNOWLEDGMENT,
          messageId,
        }),
      )

      await closeWebSocket(ws)
    })

    it('should handle invalid acknowledgment messages gracefully', async () => {
      const ws = new WebSocket(testServer.getWsUrl())

      await new Promise<void>((resolve) => {
        ws.on('open', () => resolve())
      })

      // Send invalid JSON
      ws.send('invalid json')

      // Send valid JSON but wrong format
      ws.send(JSON.stringify({ invalid: 'format' }))

      // Send acknowledgment with invalid message ID
      ws.send(
        JSON.stringify({
          type: WsMessageType.ACKNOWLEDGMENT,
          messageId: 'non-existent-id',
        }),
      )

      // Wait a bit to ensure server processes messages
      await new Promise((resolve) => setTimeout(resolve, 1000))

      // Connection should still be open
      expect(ws.readyState).toBe(WebSocket.OPEN)

      await closeWebSocket(ws)
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
