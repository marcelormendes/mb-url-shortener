import type { FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { shortenUrlRequestSchema } from '../schemas/url.schemas.js'
import type { ShortenUrlRequest } from '../types/api.types.js'
import { UrlShortenerService } from '../services/url/url-shortener.service.js'
import { WebSocketManagerService } from '../services/websocket/websocket-manager.service.js'
import { UrlException } from '../services/url/url.exceptions.js'
import { HttpStatus } from './http-status.js'

/**
 * Handler for POST /url - URL shortening endpoint
 */
export class ShortenUrlHandler {
  constructor(
    private readonly urlShortenerService: UrlShortenerService,
    private readonly wsManager: WebSocketManagerService,
  ) {}

  async handle(
    request: FastifyRequest<{ Body: ShortenUrlRequest }>,
    reply: FastifyReply,
  ): Promise<void> {
    try {
      // Validate request body with Zod
      const validatedBody = shortenUrlRequestSchema.parse(request.body)
      const { url } = validatedBody

      const mapping = await this.urlShortenerService.shortenUrl(url)

      console.log(`✅ Shortened URL generated: ${mapping.shortenedUrl} -> ${mapping.originalUrl}`)

      this.wsManager.sendShortenedUrl(mapping.shortenedUrl)

      return reply.send({
        message: 'URL shortened successfully. Result will be sent via WebSocket.',
      })
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new UrlException('URL001', HttpStatus.BAD_REQUEST, {
          validationErrors: error.errors,
        })
      }
      throw error
    }
  }
}
