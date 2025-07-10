import type { FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { WebSocketManagerService } from '../services/websocket/websocket-manager.service.js'
import { UrlException } from '../services/url/url.exceptions.js'
import { HttpStatus } from './http-status.js'

interface RegisterSessionRequest {
  sessionId: string
  clientId: string
}

const registerSessionSchema = z.object({
  sessionId: z.string().min(1, 'Session ID is required'),
  clientId: z.string().min(1, 'Client ID is required'),
})

/**
 * Handler for POST /ws/register-session - WebSocket session registration
 */
export class WebSocketSessionHandler {
  constructor(private readonly wsManager: WebSocketManagerService) {}

  async registerSession(
    request: FastifyRequest<{ Body: RegisterSessionRequest }>,
    reply: FastifyReply,
  ): Promise<void> {
    try {
      const validatedBody = registerSessionSchema.parse(request.body)
      const { sessionId, clientId } = validatedBody

      // Associate session with client
      this.wsManager.associateSession(sessionId, clientId)

      console.log(`Session ${sessionId} associated with client ${clientId}`)

      return reply.send({
        message: 'Session registered successfully',
        sessionId,
        clientId,
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

  async getStats(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const stats = this.wsManager.getStats()

    return reply.send({
      message: 'WebSocket statistics',
      ...stats,
    })
  }
}
