import { createApp } from './app.js'
import { env } from './config/env.js'

/**
 * Starts the application
 */
async function start(): Promise<void> {
  try {
    const { app, wsManager } = await createApp()

    await app.listen({
      port: env.PORT,
      host: env.HOST,
    })

    console.log(`Server listening on ${env.BASE_URL}`)
    console.log(`WebSocket server listening on ws://localhost:${env.WS_PORT}`)
    console.log(`API documentation available at ${env.BASE_URL}/documentation`)

    const gracefulShutdown = async (): Promise<void> => {
      console.log('Shutting down gracefully...')
      await app.close()
      await wsManager.close()
      process.exit(0)
    }

    process.on('SIGINT', () => {
      void gracefulShutdown()
    })
    process.on('SIGTERM', () => {
      void gracefulShutdown()
    })
  } catch (error) {
    console.error('Failed to start server:', error)
    process.exit(1)
  }
}

void start()
