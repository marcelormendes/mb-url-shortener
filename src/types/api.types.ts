/**
 * POST /url request body
 */
export interface ShortenUrlRequest {
  url: string
}

/**
 * Response sent via WebSocket
 */
export interface ShortenedUrlResponse {
  shortenedURL: string
}

/**
 * GET /:code response
 */
export interface OriginalUrlResponse {
  url: string
}

/**
 * WebSocket message types
 */
export enum WsMessageType {
  URL_SHORTENED = 'URL_SHORTENED',
  ACKNOWLEDGMENT = 'ACKNOWLEDGMENT',
  ERROR = 'ERROR',
}

/**
 * Base WebSocket message structure
 */
export interface WsMessageBase {
  type: WsMessageType
  messageId: string
}

/**
 * URL shortened message
 */
export interface WsUrlShortenedMessage extends WsMessageBase {
  type: WsMessageType.URL_SHORTENED
  data: ShortenedUrlResponse
}

/**
 * Acknowledgment message
 */
export interface WsAcknowledgmentMessage extends WsMessageBase {
  type: WsMessageType.ACKNOWLEDGMENT
}

/**
 * Error message
 */
export interface WsErrorMessage extends WsMessageBase {
  type: WsMessageType.ERROR
  data: {
    error: string
    details?: unknown
  }
}

/**
 * Union type for all WebSocket messages
 */
export type WsMessage = WsUrlShortenedMessage | WsAcknowledgmentMessage | WsErrorMessage
