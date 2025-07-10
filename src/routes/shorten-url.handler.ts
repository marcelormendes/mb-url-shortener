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

      // Get client identification from session or headers
      const sessionId = this.extractClientSession(request)

      const mapping = await this.urlShortenerService.shortenUrl(url)

      console.log(`✅ Shortened URL generated: ${mapping.shortenedUrl} -> ${mapping.originalUrl}`)

      // Send to specific client session if available, otherwise try fallback
      const messageSent = this.wsManager.sendShortenedUrlToSession(sessionId, mapping.shortenedUrl)

      // If message delivery failed, log warning
      if (!messageSent) {
        console.warn(
          'No active WebSocket session found for client. URL shortened but not delivered via WebSocket.',
        )
      }

      return reply.send({
        message: 'URL shortened successfully. Result will be sent via WebSocket.',
        shortenedUrl: mapping.shortenedUrl, // Include in response as fallback
        stats: this.wsManager.getStats(),
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

  /**
   * Extracts client session identifier from request
   */
  private extractClientSession(request: FastifyRequest): string | null {
    // Try to get session from various sources
    const headers = request.headers || {}
    const sessionId =
      (headers['x-session-id'] as string) || (headers['x-client-id'] as string) || null

    return sessionId
  }
}
