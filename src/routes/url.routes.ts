import type { FastifyInstance } from 'fastify'
import type { ShortenUrlRequest } from '../types/api.types.js'
import { UrlShortenerService } from '../services/url-shortener.service.js'
import { UrlStorageService } from '../services/url-storage.service.js'
import { WebSocketManagerService } from '../services/websocket-manager.service.js'
import { ShortenUrlHandler } from './shorten-url.handler.js'
import { GetUrlHandler } from './get-url.handler.js'
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

  constructor(private readonly wsManager: WebSocketManagerService) {
    this.urlStorageService = new UrlStorageService()
    this.urlShortenerService = new UrlShortenerService(this.urlStorageService)
    this.shortenUrlHandler = new ShortenUrlHandler(this.urlShortenerService, this.wsManager)
    this.getUrlHandler = new GetUrlHandler(this.urlStorageService)
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
  }
}
