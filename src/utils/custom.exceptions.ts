/**
 * Custom exception base class for the application
 */
export class CustomException extends Error {
  public readonly errorCode: string
  public readonly statusCode: number
  public readonly details?: unknown
  public readonly timestamp: string

  constructor(errorCode: string, message: string, statusCode: number = 500, details?: unknown) {
    super(message)
    this.name = this.constructor.name
    this.errorCode = errorCode
    this.statusCode = statusCode
    this.details = details
    this.timestamp = new Date().toISOString()
    Error.captureStackTrace(this, this.constructor)
  }

  /**
   * Converts exception to JSON response format
   */
  toJSON(): Record<string, unknown> {
    return {
      message: this.message,
      errorCode: this.errorCode,
      details: this.details,
      timestamp: this.timestamp,
    }
  }
}
