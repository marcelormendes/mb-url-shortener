import Fastify from 'fastify'
import type { FastifyInstance, FastifyServerOptions } from 'fastify'
import cors from '@fastify/cors'
import swagger from '@fastify/swagger'
import swaggerUi from '@fastify/swagger-ui'
import websocket from '@fastify/websocket'
import { env } from './config/env.js'
import { UrlRoutes } from './routes/url.routes.js'
import { WebSocketManagerService } from './services/websocket-manager.service.js'
import { CustomException } from './utils/custom.exceptions.js'

/**
 * Creates and configures the Fastify application
 */
export async function createApp(): Promise<{
  app: FastifyInstance
  wsManager: WebSocketManagerService
}> {
  const loggerOptions: FastifyServerOptions = {
    logger:
      env.NODE_ENV === 'development'
        ? {
            level: 'debug',
            transport: {
              target: 'pino-pretty',
              options: {
                translateTime: 'HH:MM:ss Z',
                ignore: 'pid,hostname',
              },
            },
          }
        : env.NODE_ENV === 'production'
          ? { level: 'info' }
          : false,
  }

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

  const wsManager = new WebSocketManagerService()

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

  return { app, wsManager }
}
