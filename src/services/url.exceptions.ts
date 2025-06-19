import { CustomException } from '../utils/custom.exceptions.js'

/**
 * Error codes for URL-related operations
 */
export const errorCodes = Object.freeze({
  URL001: 'Invalid request format: {validationErrors}',
  URL002: 'URL code not found: {code}',
  URL003: 'Failed to generate unique code after {attempts} attempts',
  URL004: 'URL storage operation failed: {operation}',
})

/**
 * URL-specific exception class
 */
export class UrlException extends CustomException {
  constructor(
    code: keyof typeof errorCodes,
    statusCode: number,
    details?: Record<string, unknown>,
  ) {
    const template = errorCodes[code]
    let message: string = template

    if (details) {
      Object.entries(details).forEach(([key, value]) => {
        message = message.replaceAll(`{${key}}`, String(value))
      })
    }

    super(code, message, statusCode, details)
    console.error(`ERROR ${code}: ${message}`, details)
  }
}
