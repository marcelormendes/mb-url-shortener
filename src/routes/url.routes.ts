import type { FastifyInstance } from 'fastify'
import type { ShortenUrlRequest } from '../types/api.types.js'
import { UrlShortenerService } from '../services/url/url-shortener.service.js'
import { UrlStorageService } from '../services/url/url-storage.service.js'
import { WebSocketManagerService } from '../services/websocket/websocket-manager.service.js'
import { ShortenUrlHandler } from './shorten-url.handler.js'
import { GetUrlHandler } from './get-url.handler.js'
import { WebSocketSessionHandler } from './websocket-session.handler.js'
import {
  shortenUrlRequestSchema,
  shortenUrlResponseSchemas,
  getUrlParamsSchema,
  getUrlResponseSchemas,
} from './url-route.schemas.js'

/**
 * URL routes registration
 */
export class UrlRoutes {
  private readonly urlStorageService: UrlStorageService
  private readonly urlShortenerService: UrlShortenerService
  private readonly shortenUrlHandler: ShortenUrlHandler
  private readonly getUrlHandler: GetUrlHandler
  private readonly wsSessionHandler: WebSocketSessionHandler

  constructor(private readonly wsManager: WebSocketManagerService) {
    this.urlStorageService = new UrlStorageService()
    this.urlShortenerService = new UrlShortenerService(this.urlStorageService)
    this.shortenUrlHandler = new ShortenUrlHandler(this.urlShortenerService, this.wsManager)
    this.getUrlHandler = new GetUrlHandler(this.urlStorageService)
    this.wsSessionHandler = new WebSocketSessionHandler(this.wsManager)
  }

  /**
   * Registers URL routes with Fastify instance
   */
  register(fastify: FastifyInstance): void {
    // POST /url - Shorten URL endpoint
    fastify.post<{ Body: ShortenUrlRequest }>(
      '/url',
      {
        schema: {
          body: shortenUrlRequestSchema,
          response: shortenUrlResponseSchemas,
          tags: ['URL'],
          summary: 'Shorten a URL',
          description: 'Creates a shortened URL and sends the result via WebSocket',
        },
      },
      this.shortenUrlHandler.handle.bind(this.shortenUrlHandler),
    )

    // GET /:code - Get original URL endpoint
    fastify.get<{ Params: { code: string } }>(
      '/:code',
      {
        schema: {
          params: getUrlParamsSchema,
          response: getUrlResponseSchemas,
          tags: ['URL'],
          summary: 'Get original URL',
          description: 'Retrieves the original URL from a shortened code',
        },
      },
      this.getUrlHandler.handle.bind(this.getUrlHandler),
    )

    // POST /ws/register-session - Register WebSocket session
    fastify.post(
      '/ws/register-session',
      {
        schema: {
          body: {
            type: 'object',
            required: ['sessionId', 'clientId'],
            properties: {
              sessionId: { type: 'string', minLength: 1 },
              clientId: { type: 'string', minLength: 1 },
            },
          },
          response: {
            200: {
              type: 'object',
              properties: {
                message: { type: 'string' },
                sessionId: { type: 'string' },
                clientId: { type: 'string' },
                stats: {
                  type: 'object',
                  properties: {
                    connectedClients: { type: 'number' },
                    pendingMessages: { type: 'number' },
                    activeSessions: { type: 'number' },
                  },
                },
              },
            },
          },
          tags: ['WebSocket'],
          summary: 'Register WebSocket session',
          description: 'Associates a session ID with a WebSocket client ID for targeted messaging',
        },
      },
      this.wsSessionHandler.registerSession.bind(this.wsSessionHandler),
    )

    // GET /ws/stats - Get WebSocket statistics
    fastify.get(
      '/ws/stats',
      {
        schema: {
          response: {
            200: {
              type: 'object',
              properties: {
                message: { type: 'string' },
                connectedClients: { type: 'number' },
                pendingMessages: { type: 'number' },
                activeSessions: { type: 'number' },
              },
            },
          },
          tags: ['WebSocket'],
          summary: 'Get WebSocket statistics',
          description: 'Returns current WebSocket connection and message statistics',
        },
      },
      this.wsSessionHandler.getStats.bind(this.wsSessionHandler),
    )
  }
}
