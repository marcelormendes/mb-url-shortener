import type { ShortenedUrlResponse } from './api.types.js'

/**
 * URL mapping stored in memory
 */
export interface UrlMapping {
  code: string
  originalUrl: string
  shortenedUrl: string
  createdAt: Date
}

/**
 * WebSocket client information
 */
export interface WsClient {
  id: string
  ws: import('ws').WebSocket
  pendingMessages: PendingMessage[]
}

/**
 * Pending message for retry mechanism
 */
export interface PendingMessage {
  id: string
  data: ShortenedUrlResponse
  attempts: number
  lastAttempt: Date
}
