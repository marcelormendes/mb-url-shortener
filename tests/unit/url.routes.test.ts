/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call */
import { UrlRoutes } from '../../src/routes/url.routes'
import { WebSocketManagerService } from '../../src/services/websocket-manager.service'
import { UrlException } from '../../src/services/url.exceptions'
import { UrlShortenerService } from '../../src/services/url-shortener.service'
import { UrlStorageService } from '../../src/services/url-storage.service'
import type { FastifyInstance } from 'fastify'

// Mock services
jest.mock('../../src/services/url-storage.service')
jest.mock('../../src/services/url-shortener.service')
jest.mock('../../src/services/websocket-manager.service')

describe('UrlRoutes', () => {
  let urlRoutes: UrlRoutes
  let mockWsManager: jest.Mocked<WebSocketManagerService>
  let mockFastify: jest.Mocked<FastifyInstance>
  let mockUrlShortenerService: jest.Mocked<UrlShortenerService>
  let mockUrlStorageService: jest.Mocked<UrlStorageService>

  beforeEach(() => {
    // Create mock services
    mockUrlStorageService = {
      store: jest.fn(),
      get: jest.fn(),
      exists: jest.fn(),
    } as any

    mockUrlShortenerService = {
      shortenUrl: jest.fn(),
    } as any

    // Create mock WebSocket manager
    mockWsManager = {
      sendShortenedUrl: jest.fn(),
      close: jest.fn(),
    } as any

    // Create mock Fastify instance
    mockFastify = {
      post: jest.fn(),
      get: jest.fn(),
    } as any

    // Mock constructor calls
    jest.mocked(UrlStorageService).mockImplementation(() => mockUrlStorageService)
    jest.mocked(UrlShortenerService).mockImplementation(() => mockUrlShortenerService)

    urlRoutes = new UrlRoutes(mockWsManager)
    jest.clearAllMocks()
  })

  describe('register', () => {
    it('should register POST /url route', () => {
      urlRoutes.register(mockFastify)

      expect(mockFastify.post).toHaveBeenCalledWith(
        '/url',
        expect.objectContaining({
          schema: expect.objectContaining({
            body: expect.any(Object),
            response: expect.any(Object),
            tags: ['URL'],
            summary: 'Shorten a URL',
          }),
        }),
        expect.any(Function),
      )
    })

    it('should register GET /:code route', () => {
      urlRoutes.register(mockFastify)

      expect(mockFastify.get).toHaveBeenCalledWith(
        '/:code',
        expect.objectContaining({
          schema: expect.objectContaining({
            params: expect.any(Object),
            response: expect.any(Object),
            tags: ['URL'],
            summary: 'Get original URL',
          }),
        }),
        expect.any(Function),
      )
    })
  })

  describe('POST /url handler', () => {
    let postHandler: any
    let mockRequest: any
    let mockReply: any

    beforeEach(() => {
      urlRoutes.register(mockFastify)
      postHandler = mockFastify.post.mock.calls[0]?.[2] as any

      mockRequest = {
        body: { url: 'https://example.com' },
      }

      mockReply = {
        send: jest.fn(),
      }
    })

    it('should successfully shorten URL and send WebSocket message', async () => {
      const shortenedUrl = 'http://localhost:3000/abc123xyz0'

      mockUrlShortenerService.shortenUrl.mockResolvedValue({
        code: 'abc123xyz0',
        originalUrl: 'https://example.com',
        shortenedUrl,
        createdAt: new Date(),
      })

      await postHandler(mockRequest, mockReply)

      expect(mockWsManager.sendShortenedUrl).toHaveBeenCalledWith(shortenedUrl)
      expect(mockReply.send).toHaveBeenCalledWith({
        message: 'URL shortened successfully. Result will be sent via WebSocket.',
      })
    })

    it('should handle WebSocket send errors gracefully', async () => {
      mockUrlShortenerService.shortenUrl.mockResolvedValue({
        code: 'abc123xyz0',
        originalUrl: 'https://example.com',
        shortenedUrl: 'http://localhost:3000/abc123xyz0',
        createdAt: new Date(),
      })

      // Mock WebSocket send to do nothing (simulating no connected client)
      mockWsManager.sendShortenedUrl.mockImplementation(() => {
        // In the actual implementation, this just logs a warning and continues
      })

      await postHandler(mockRequest, mockReply)

      expect(mockReply.send).toHaveBeenCalledWith({
        message: 'URL shortened successfully. Result will be sent via WebSocket.',
      })
    })

    it('should validate request body with Zod', async () => {
      mockRequest.body = { url: 'invalid-url' }

      await expect(postHandler(mockRequest, mockReply)).rejects.toThrow()
    })

    it('should handle URL shortener service errors', async () => {
      mockUrlShortenerService.shortenUrl.mockRejectedValue(new Error('Shortener error'))

      await expect(postHandler(mockRequest, mockReply)).rejects.toThrow('Shortener error')
    })
  })

  describe('GET /:code handler', () => {
    let getHandler: any
    let mockRequest: any
    let mockReply: any

    beforeEach(() => {
      urlRoutes.register(mockFastify)
      getHandler = mockFastify.get.mock.calls[0]?.[2] as any

      mockRequest = {
        params: { code: 'abc123xyz0' },
      }

      mockReply = {
        send: jest.fn(),
      }
    })

    it('should successfully retrieve original URL', async () => {
      const mockMapping = {
        code: 'abc123xyz0',
        originalUrl: 'https://example.com',
        shortenedUrl: 'http://localhost:3000/abc123xyz0',
        createdAt: new Date(),
      }

      mockUrlStorageService.get.mockResolvedValue(mockMapping)

      await getHandler(mockRequest, mockReply)

      expect(mockReply.send).toHaveBeenCalledWith({
        url: 'https://example.com',
      })
    })

    it('should throw UrlException for non-existent code', async () => {
      mockUrlStorageService.get.mockResolvedValue(null)

      await expect(getHandler(mockRequest, mockReply)).rejects.toThrow(UrlException)
      await expect(getHandler(mockRequest, mockReply)).rejects.toThrow(
        'URL code not found: abc123xyz0',
      )
    })

    it('should validate code parameter with Zod', async () => {
      mockRequest.params.code = 'invalid' // Too short

      await expect(getHandler(mockRequest, mockReply)).rejects.toThrow()
    })

    it('should handle storage service errors', async () => {
      mockUrlStorageService.get.mockRejectedValue(new Error('Storage error'))

      await expect(getHandler(mockRequest, mockReply)).rejects.toThrow('Storage error')
    })
  })

  describe('schema validation', () => {
    it('should have correct POST route schema', () => {
      urlRoutes.register(mockFastify)

      const postRouteCall = mockFastify.post.mock.calls[0]
      const schema = postRouteCall?.[1]?.schema as any

      expect(schema.body).toEqual({
        type: 'object',
        required: ['url'],
        properties: {
          url: {
            type: 'string',
            description: 'The URL to be shortened',
          },
        },
      })

      expect(schema.response[200]).toEqual({
        type: 'object',
        properties: {
          message: {
            type: 'string',
            description:
              'Success message indicating URL was shortened and will be sent via WebSocket',
          },
        },
        example: {
          message: 'URL shortened successfully. Result will be sent via WebSocket.',
        },
      })
    })

    it('should have correct GET route schema', () => {
      urlRoutes.register(mockFastify)

      const getRouteCall = mockFastify.get.mock.calls[0]
      const schema = getRouteCall?.[1]?.schema as any

      expect(schema.params).toEqual({
        type: 'object',
        properties: {
          code: {
            type: 'string',
            pattern: '^[a-zA-Z0-9]{10}$',
            description: 'The 10-character alphanumeric code representing the shortened URL',
          },
        },
        required: ['code'],
      })

      expect(schema.response[200]).toEqual({
        type: 'object',
        properties: {
          url: {
            type: 'string',
            format: 'uri',
            description: 'The original URL that was shortened',
          },
        },
        example: {
          url: 'https://example.com/very/long/url',
        },
      })
    })
  })

  describe('edge cases', () => {
    it('should handle concurrent POST requests', async () => {
      urlRoutes.register(mockFastify)
      const postHandler = mockFastify.post.mock.calls[0]?.[2] as any

      const requests = Array.from({ length: 5 }, (_, i) => ({
        body: { url: `https://example${i}.com` },
      }))

      const mockReply = { send: jest.fn() }

      mockUrlShortenerService.shortenUrl.mockResolvedValue({
        code: 'test123456',
        originalUrl: 'https://example.com',
        shortenedUrl: 'http://localhost:3000/test123456',
        createdAt: new Date(),
      })

      const promises = requests.map((req) => postHandler?.call(mockFastify, req, mockReply))
      await Promise.all(promises)

      expect(mockReply.send).toHaveBeenCalledTimes(5)
    })

    it('should handle concurrent GET requests', async () => {
      urlRoutes.register(mockFastify)
      const getHandler = mockFastify.get.mock.calls[0]?.[2] as any

      const requests = Array.from({ length: 5 }, () => ({
        params: { code: 'abc123xyz0' },
      }))

      const mockReply = { send: jest.fn() }

      mockUrlStorageService.get.mockResolvedValue({
        code: 'abc123xyz0',
        originalUrl: 'https://example.com',
        shortenedUrl: 'http://localhost:3000/abc123xyz0',
        createdAt: new Date(),
      })

      const promises = requests.map((req) => getHandler?.call(mockFastify, req, mockReply))
      await Promise.all(promises)

      expect(mockReply.send).toHaveBeenCalledTimes(5)
    })
  })
})
