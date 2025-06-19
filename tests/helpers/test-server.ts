import Fastify from 'fastify'
import type { FastifyInstance, FastifyServerOptions } from 'fastify'
import cors from '@fastify/cors'
import swagger from '@fastify/swagger'
import swaggerUi from '@fastify/swagger-ui'
import websocket from '@fastify/websocket'
import { env } from '../../src/config/env.js'
import { UrlRoutes } from '../../src/routes/url.routes.js'
import { WebSocketManagerService } from '../../src/services/websocket/websocket-manager.service.js'
import { CustomException } from '../../src/utils/custom.exceptions.js'

/**
 * Test server helper for E2E tests
 */
export class TestServer {
  public app: FastifyInstance | null = null
  public wsManager: WebSocketManagerService | null = null
  private isListening = false

  /**
   * Start the test server
   */
  async start(): Promise<void> {
    if (this.app) {
      throw new Error('Server is already started')
    }

    // Create Fastify app with test configuration
    const loggerOptions: FastifyServerOptions = { logger: false }
    const app = Fastify(loggerOptions)

    await app.register(cors, {
      origin: true,
      credentials: true,
    })

    await app.register(websocket)

    await app.register(swagger, {
      openapi: {
        info: {
          title: 'URL Shortener API',
          description: 'API for shortening URLs with WebSocket delivery',
          version: '1.0.0',
        },
        servers: [
          {
            url: env.BASE_URL,
            description: 'Development server',
          },
        ],
        tags: [
          {
            name: 'URL',
            description: 'URL shortening operations',
          },
        ],
      },
    })

    await app.register(swaggerUi, {
      routePrefix: '/documentation',
      uiConfig: {
        docExpansion: 'list',
        deepLinking: false,
      },
      staticCSP: true,
      transformStaticCSP: (header) => header,
      transformSpecification: (swaggerObject) => swaggerObject,
      transformSpecificationClone: true,
    })

    // Create WebSocket manager with dynamic port (0 = random available port)
    const wsManager = new WebSocketManagerService(0)

    app.setErrorHandler((error, _request, reply) => {
      if (error instanceof CustomException) {
        return reply.status(error.statusCode).send(error.toJSON())
      }

      if (error.validation) {
        return reply.status(400).send({
          message: 'Validation error',
          errorCode: 'URL001',
          details: error.validation,
          timestamp: new Date().toISOString(),
        })
      }

      app.log.error(error)
      return reply.status(500).send({
        message: 'Internal server error',
        errorCode: 'INTERNAL_ERROR',
        timestamp: new Date().toISOString(),
      })
    })

    const urlRoutes = new UrlRoutes(wsManager)
    await app.register((fastify, _opts, done) => {
      try {
        urlRoutes.register(fastify)
        done()
      } catch (error) {
        done(error instanceof Error ? error : new Error(String(error)))
      }
    })

    this.app = app
    this.wsManager = wsManager

    await app.listen({ port: 0, host: '127.0.0.1' })
    this.isListening = true
  }

  /**
   * Stop the test server
   */
  async stop(): Promise<void> {
    if (!this.app) {
      return
    }

    // Close WebSocket manager first to stop all background processes
    if (this.wsManager) {
      await this.wsManager.close()
      this.wsManager = null
    }

    // Then close the HTTP server
    if (this.isListening) {
      await this.app.close()
      this.isListening = false
    }

    this.app = null

    // Give a small delay to ensure all async cleanup is complete
    await new Promise((resolve) => setTimeout(resolve, 50))
  }

  /**
   * Get the server URL
   */
  getUrl(): string {
    if (!this.app || !this.isListening) {
      throw new Error('Server is not started')
    }

    const address = this.app.server.address()
    if (!address || typeof address === 'string') {
      throw new Error('Unable to get server address')
    }

    return `http://127.0.0.1:${address.port}`
  }

  /**
   * Get the WebSocket URL
   */
  getWsUrl(): string {
    if (!this.wsManager) {
      throw new Error('WebSocket manager is not started')
    }

    const port = this.wsManager.getPort()
    return `ws://127.0.0.1:${port}`
  }
}
