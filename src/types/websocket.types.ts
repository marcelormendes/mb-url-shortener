/**
 * WebSocket-specific types and interfaces
 */

export interface PendingMessage {
  id: string
  data: { shortenedURL: string }
  attempts: number
  lastAttempt: Date
}

export interface RetryConfig {
  maxAttempts: number
  retryDelay: number
  checkInterval: number
}

export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 5,
  retryDelay: 30000, // 30 seconds
  checkInterval: 5000, // 5 seconds
}
