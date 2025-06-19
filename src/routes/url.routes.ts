import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { shortenUrlRequestSchema, urlCodeSchema } from '../schemas/url.schemas.js'
import type { ShortenUrlRequest, OriginalUrlResponse } from '../types/api.types.js'
import { UrlShortenerService } from '../services/url-shortener.service.js'
import { UrlStorageService } from '../services/url-storage.service.js'
import { WebSocketManagerService } from '../services/websocket-manager.service.js'
import { UrlException } from '../services/url.exceptions.js'

enum HttpStatus {
  BAD_REQUEST = 400,
  NOT_FOUND = 404,
  INTERNAL_SERVER_ERROR = 500,
}

/**
 * URL routes handler
 */
export class UrlRoutes {
  private urlShortenerService: UrlShortenerService
  private urlStorageService: UrlStorageService

  constructor(private readonly wsManager: WebSocketManagerService) {
    this.urlStorageService = new UrlStorageService()
    this.urlShortenerService = new UrlShortenerService(this.urlStorageService)
  }

  /**
   * Registers URL routes
   */
  register(fastify: FastifyInstance): void {
    fastify.post<{ Body: ShortenUrlRequest }>(
      '/url',
      {
        schema: {
          body: {
            type: 'object',
            required: ['url'],
            properties: {
              url: {
                type: 'string',
                description: 'The URL to be shortened',
              },
            },
          },
          response: {
            200: {
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
            },
            400: {
              type: 'object',
              properties: {
                message: {
                  type: 'string',
                  description: 'Human-readable error message',
                },
                errorCode: {
                  type: 'string',
                  description: 'Machine-readable error code for programmatic handling',
                },
                details: {
                  type: 'object',
                  description: 'Additional error details and context',
                },
                timestamp: {
                  type: 'string',
                  format: 'date-time',
                  description: 'ISO timestamp when the error occurred',
                },
              },
              example: {
                message: 'Validation error',
                errorCode: 'URL001',
                details: [{ message: 'Required', path: ['url'] }],
                timestamp: '2024-01-01T12:00:00.000Z',
              },
            },
            500: {
              type: 'object',
              properties: {
                message: {
                  type: 'string',
                  description: 'Human-readable error message',
                },
                errorCode: {
                  type: 'string',
                  description: 'Machine-readable error code for programmatic handling',
                },
                details: {
                  type: 'object',
                  description: 'Additional error details and context',
                },
                timestamp: {
                  type: 'string',
                  format: 'date-time',
                  description: 'ISO timestamp when the error occurred',
                },
              },
              example: {
                message: 'Failed to generate unique code after 10 attempts',
                errorCode: 'URL003',
                details: { attempts: 10 },
                timestamp: '2024-01-01T12:00:00.000Z',
              },
            },
          },
          tags: ['URL'],
          summary: 'Shorten a URL',
          description: 'Creates a shortened URL and sends the result via WebSocket',
        },
      },
      async (request: FastifyRequest<{ Body: ShortenUrlRequest }>, reply: FastifyReply) => {
        try {
          // Validate request body with Zod
          const validatedBody = shortenUrlRequestSchema.parse(request.body)
          const { url } = validatedBody

          const mapping = await this.urlShortenerService.shortenUrl(url)

          console.log(
            `✅ Shortened URL generated: ${mapping.shortenedUrl} -> ${mapping.originalUrl}`,
          )

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
      },
    )

    fastify.get<{ Params: { code: string } }>(
      '/:code',
      {
        schema: {
          params: {
            type: 'object',
            properties: {
              code: {
                type: 'string',
                pattern: '^[a-zA-Z0-9]{10}$',
                description: 'The 10-character alphanumeric code representing the shortened URL',
              },
            },
            required: ['code'],
          },
          response: {
            200: {
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
            },
            400: {
              type: 'object',
              properties: {
                message: {
                  type: 'string',
                  description: 'Human-readable error message',
                },
                errorCode: {
                  type: 'string',
                  description: 'Machine-readable error code for programmatic handling',
                },
                details: {
                  type: 'object',
                  description: 'Additional error details and context',
                },
                timestamp: {
                  type: 'string',
                  format: 'date-time',
                  description: 'ISO timestamp when the error occurred',
                },
              },
              example: {
                message: 'Validation error',
                errorCode: 'URL001',
                details: [{ message: 'Invalid format', path: ['code'] }],
                timestamp: '2024-01-01T12:00:00.000Z',
              },
            },
            404: {
              type: 'object',
              properties: {
                message: {
                  type: 'string',
                  description: 'Human-readable error message',
                },
                errorCode: {
                  type: 'string',
                  description: 'Machine-readable error code for programmatic handling',
                },
                details: {
                  type: 'object',
                  description: 'Additional error details and context',
                },
                timestamp: {
                  type: 'string',
                  format: 'date-time',
                  description: 'ISO timestamp when the error occurred',
                },
              },
              example: {
                message: 'URL code not found: abc123xyz0',
                errorCode: 'URL002',
                details: { code: 'abc123xyz0' },
                timestamp: '2024-01-01T12:00:00.000Z',
              },
            },
            500: {
              type: 'object',
              properties: {
                message: {
                  type: 'string',
                  description: 'Human-readable error message',
                },
                errorCode: {
                  type: 'string',
                  description: 'Machine-readable error code for programmatic handling',
                },
                details: {
                  type: 'object',
                  description: 'Additional error details and context',
                },
                timestamp: {
                  type: 'string',
                  format: 'date-time',
                  description: 'ISO timestamp when the error occurred',
                },
              },
              example: {
                message: 'URL storage operation failed: get',
                errorCode: 'URL004',
                details: { operation: 'get' },
                timestamp: '2024-01-01T12:00:00.000Z',
              },
            },
          },
          tags: ['URL'],
          summary: 'Get original URL',
          description: 'Retrieves the original URL from a shortened code',
        },
      },
      async (request: FastifyRequest<{ Params: { code: string } }>, reply: FastifyReply) => {
        const { code } = request.params

        const validatedCode = urlCodeSchema.parse(code)

        const mapping = await this.urlStorageService.get(validatedCode)
        if (!mapping) {
          throw new UrlException('URL002', 404, { code: validatedCode })
        }

        const response: OriginalUrlResponse = {
          url: mapping.originalUrl,
        }

        return reply.send(response)
      },
    )
  }
}
