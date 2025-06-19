import supertest from 'supertest'
import { TestServer } from '../helpers/test-server'
import WebSocket from 'ws'
import { WsMessageType } from '../../src/types/api.types'
import type { WsMessage } from '../../src/types/api.types'

describe('URL Shortening E2E Tests', () => {
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

  describe('Complete URL Shortening Flow', () => {
    it('should shorten URL and retrieve original URL', async () => {
      const testUrl = 'https://example.com/very/long/url/that/needs/shortening'

      // Connect to WebSocket
      const ws = new WebSocket(testServer.getWsUrl())

      // Wait for WebSocket connection to establish
      await new Promise<void>((resolve) => {
        ws.on('open', () => resolve())
      })

      // Set up message handler to capture shortened URL
      const wsMessagePromise = new Promise<string>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('WebSocket message timeout'))
        }, 5000)

        ws.on('message', (data) => {
          try {
            const message = JSON.parse(data.toString()) as WsMessage
            if (message.type === WsMessageType.URL_SHORTENED) {
              clearTimeout(timeout)

              resolve(message.data.shortenedURL)

              // Send acknowledgment
              ws.send(
                JSON.stringify({
                  type: WsMessageType.ACKNOWLEDGMENT,
                  messageId: message.messageId,
                }),
              )
            }
          } catch (error) {
            clearTimeout(timeout)
            reject(error instanceof Error ? error : new Error(String(error)))
          }
        })

        ws.on('error', (error) => {
          clearTimeout(timeout)
          reject(error)
        })
      })

      // Make POST request to shorten URL
      const postResponse = await request.post('/url').send({ url: testUrl }).expect(200)

      expect(postResponse.body).toEqual({
        message: 'URL shortened successfully. Result will be sent via WebSocket.',
      })

      // Wait for WebSocket message with shortened URL
      const shortenedUrl = await wsMessagePromise

      expect(shortenedUrl).toMatch(/^http:\/\/(127\.0\.0\.1|localhost):\d+\/[a-zA-Z0-9]{10}$/)

      // Extract the code from the shortened URL
      const urlParts = shortenedUrl.split('/')
      const code = urlParts[urlParts.length - 1]

      expect(code).toHaveLength(10)
      expect(code).toMatch(/^[a-zA-Z0-9]{10}$/)

      // Make GET request to retrieve original URL
      const getResponse = await request.get(`/${code}`).expect(200)

      expect(getResponse.body).toEqual({
        url: testUrl,
      })

      await closeWebSocket(ws)
    }, 15000)

    it('should handle multiple concurrent URL shortening requests', async () => {
      const testUrls = [
        'https://example1.com/test',
        'https://example2.com/test',
        'https://example3.com/test',
        'https://example4.com/test',
        'https://example5.com/test',
      ]

      // Create a single WebSocket connection (only one client supported now)
      const ws = new WebSocket(testServer.getWsUrl())
      await new Promise<void>((resolve) => {
        ws.on('open', () => resolve())
      })

      const receivedUrls: string[] = []
      let messagesReceived = 0
      const expectedMessages = testUrls.length

      // Set up message handler to collect all shortened URLs
      const allMessagesPromise = new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error(`Only received ${messagesReceived}/${expectedMessages} messages`))
        }, 10000)

        ws.on('message', (data) => {
          try {
            const message = JSON.parse(data.toString()) as WsMessage
            if (message.type === WsMessageType.URL_SHORTENED) {
              messagesReceived++
              receivedUrls.push(message.data.shortenedURL)

              // Send acknowledgment
              ws.send(
                JSON.stringify({
                  type: WsMessageType.ACKNOWLEDGMENT,
                  messageId: message.messageId,
                }),
              )

              // Check if we've received all expected messages
              if (messagesReceived >= expectedMessages) {
                clearTimeout(timeout)
                resolve()
              }
            }
          } catch (error) {
            clearTimeout(timeout)
            reject(error instanceof Error ? error : new Error(String(error)))
          }
        })

        ws.on('error', (error) => {
          clearTimeout(timeout)
          reject(error)
        })
      })

      // Make concurrent POST requests
      const postPromises = testUrls.map((url) => request.post('/url').send({ url }).expect(200))

      const postResponses = await Promise.all(postPromises)

      // Verify all POST responses
      postResponses.forEach((response) => {
        expect(response.body).toEqual({
          message: 'URL shortened successfully. Result will be sent via WebSocket.',
        })
      })

      // Wait for all WebSocket messages
      await allMessagesPromise

      // Verify we received all shortened URLs
      expect(receivedUrls).toHaveLength(testUrls.length)

      // Verify all shortened URLs are unique
      const uniqueUrls = new Set(receivedUrls)
      expect(uniqueUrls.size).toBe(testUrls.length)

      // Test retrieval of all shortened URLs
      const getPromises = receivedUrls.map((shortenedUrl) => {
        const urlParts = shortenedUrl.split('/')
        const code = urlParts[urlParts.length - 1]
        return request.get(`/${code}`).expect(200)
      })

      const getResponses = await Promise.all(getPromises)

      // Verify all original URLs are retrieved correctly
      getResponses.forEach((response) => {
        expect(testUrls).toContain((response.body as { url: string }).url)
      })

      await closeWebSocket(ws)
    }, 30000)
  })

  describe('Error Handling', () => {
    it('should return error for invalid URL', async () => {
      const response = await request.post('/url').send({ url: 'not a url at all!' })

      expect([400, 500]).toContain(response.status)
      expect(response.body).toHaveProperty('message')
    })

    it('should return 400 for single character invalid URL', async () => {
      const response = await request.post('/url').send({ url: 'x' }).expect(400)

      expect(response.body).toHaveProperty('message')
      expect(response.body).toHaveProperty('errorCode')
      expect((response.body as { errorCode: string }).errorCode).toBe('URL001')
    })

    it('should return 400 for URL with backslashes', async () => {
      const response = await request
        .post('/url')
        .send({ url: 'www.example.com/file\\path' })
        .expect(400)

      expect(response.body).toHaveProperty('message')
      expect(response.body).toHaveProperty('errorCode')
      expect((response.body as { errorCode: string }).errorCode).toBe('URL001')
    })

    it('should return 400 for missing URL', async () => {
      const response = await request.post('/url').send({}).expect(400)

      expect(response.body).toHaveProperty('message')
    })

    it('should return 404 for non-existent code', async () => {
      const response = await request.get('/abcd123456').expect(404)

      expect(response.body).toHaveProperty('message')
      expect(response.body).toHaveProperty('errorCode')
      expect((response.body as { errorCode: string }).errorCode).toBe('URL002')
    })

    it('should return 400 for invalid code format', async () => {
      const response = await request.get('/short').expect(400)

      expect(response.body).toHaveProperty('message')
    })

    it('should handle special characters in URLs', async () => {
      const testUrl = 'https://example.com/path?query=value&param=test#fragment'

      // Connect to WebSocket
      const ws = new WebSocket(testServer.getWsUrl())

      // Wait for WebSocket connection to establish
      await new Promise<void>((resolve) => {
        ws.on('open', () => resolve())
      })

      // Set up message handler
      const wsMessagePromise = new Promise<string>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('WebSocket message timeout'))
        }, 5000)

        ws.on('message', (data) => {
          try {
            const message = JSON.parse(data.toString()) as WsMessage
            if (message.type === WsMessageType.URL_SHORTENED) {
              clearTimeout(timeout)

              resolve(message.data.shortenedURL)

              // Send acknowledgment
              ws.send(
                JSON.stringify({
                  type: WsMessageType.ACKNOWLEDGMENT,
                  messageId: message.messageId,
                }),
              )
            }
          } catch (error) {
            clearTimeout(timeout)
            reject(error instanceof Error ? error : new Error(String(error)))
          }
        })
      })

      // Make POST request
      await request.post('/url').send({ url: testUrl }).expect(200)

      // Wait for WebSocket message
      const shortenedUrl = await wsMessagePromise

      // Extract code and test retrieval
      const urlParts = shortenedUrl.split('/')
      const code = urlParts[urlParts.length - 1]

      const getResponse = await request.get(`/${code}`).expect(200)

      expect(getResponse.body).toEqual({
        url: testUrl,
      })

      await closeWebSocket(ws)
    }, 10000)
  })

  describe('API Documentation', () => {
    it('should serve Swagger documentation', async () => {
      const response = await request.get('/documentation').expect(200)

      expect(response.text).toContain('swagger')
    })

    it('should serve OpenAPI JSON', async () => {
      const response = await request.get('/documentation/json').expect(200)

      expect(response.body).toHaveProperty('openapi')
      expect(response.body).toHaveProperty('info')
      expect(response.body).toHaveProperty('paths')
      const apiDoc = response.body as { paths: Record<string, unknown> }
      expect(apiDoc.paths).toHaveProperty('/url')
      expect(apiDoc.paths).toHaveProperty('/{code}')
    })
  })

  describe('Performance', () => {
    it('should handle rapid URL shortening requests', async () => {
      const startTime = Date.now()
      const requestCount = 50
      const testUrl = 'https://example.com/performance-test'

      // Create a single WebSocket connection (only one is supported now)
      const ws = new WebSocket(testServer.getWsUrl())
      await new Promise<void>((resolve) => {
        ws.on('open', () => resolve())
      })

      // Set up message handler for the single connection
      let messagesReceived = 0
      const targetMessages = requestCount

      const allMessagesPromise = new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error(`Only received ${messagesReceived}/${targetMessages} messages`))
        }, 15000)

        ws.on('message', (data) => {
          try {
            const message = JSON.parse(data.toString()) as WsMessage
            if (message.type === WsMessageType.URL_SHORTENED) {
              messagesReceived++

              // Send acknowledgment
              ws.send(
                JSON.stringify({
                  type: WsMessageType.ACKNOWLEDGMENT,
                  messageId: message.messageId,
                }),
              )

              // Check if we've received all expected messages
              if (messagesReceived >= targetMessages) {
                clearTimeout(timeout)
                resolve()
              }
            }
          } catch (error) {
            clearTimeout(timeout)
            reject(error instanceof Error ? error : new Error(String(error)))
          }
        })
      })

      // Make rapid POST requests (they'll all go to the single WebSocket connection)
      const postPromises = Array.from({ length: requestCount }, () =>
        request.post('/url').send({ url: testUrl }).expect(200),
      )

      await Promise.all(postPromises)
      await allMessagesPromise

      const endTime = Date.now()
      const duration = endTime - startTime

      console.log(`Processed ${requestCount} requests in ${duration}ms`)
      expect(duration).toBeLessThan(10000) // Should complete within 10 seconds

      // Close the WebSocket connection
      await closeWebSocket(ws)
    }, 20000)
  })
})
