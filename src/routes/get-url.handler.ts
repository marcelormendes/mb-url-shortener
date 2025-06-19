import type { FastifyRequest, FastifyReply } from 'fastify'
import { urlCodeSchema } from '../schemas/url.schemas.js'
import type { OriginalUrlResponse } from '../types/api.types.js'
import { UrlStorageService } from '../services/url/url-storage.service.js'
import { UrlException } from '../services/url/url.exceptions.js'
import { HttpStatus } from './http-status.js'

/**
 * Handler for GET /:code - URL retrieval endpoint
 */
export class GetUrlHandler {
  constructor(private readonly urlStorageService: UrlStorageService) {}

  async handle(
    request: FastifyRequest<{ Params: { code: string } }>,
    reply: FastifyReply,
  ): Promise<void> {
    const { code } = request.params

    const validatedCode = urlCodeSchema.parse(code)

    const mapping = await this.urlStorageService.get(validatedCode)
    if (!mapping) {
      throw new UrlException('URL002', HttpStatus.NOT_FOUND, { code: validatedCode })
    }

    const response: OriginalUrlResponse = {
      url: mapping.originalUrl,
    }

    return reply.send(response)
  }
}
