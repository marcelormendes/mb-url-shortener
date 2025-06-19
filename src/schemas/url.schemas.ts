import { z } from 'zod'

/**
 * Schema for POST /url request body
 */
export const shortenUrlRequestSchema = z.object({
  url: z
    .string()
    .min(1, 'URL cannot be empty')
    .transform((val) => {
      // Add https:// if no protocol is specified
      if (!val.match(/^https?:\/\//)) {
        return `https://${val}`
      }
      return val
    })
    .pipe(
      z
        .string()
        .url('Invalid URL format')
        .refine(
          (url) => {
            try {
              const urlObj = new URL(url)
              // Require at least one dot in hostname (e.g., example.com)
              // or be localhost for testing
              const hasValidDomain =
                urlObj.hostname.includes('.') ||
                urlObj.hostname === 'localhost' ||
                urlObj.hostname.match(/^\d+\.\d+\.\d+\.\d+$/) // IP address

              // Check for invalid characters in URL path
              const hasInvalidPathChars = url.includes('\\')

              return hasValidDomain && !hasInvalidPathChars
            } catch {
              return false
            }
          },
          {
            message: 'URL must have a valid domain name and no invalid characters like backslashes',
          },
        ),
    ),
})

/**
 * Schema for URL code parameter
 */
export const urlCodeSchema = z
  .string()
  .length(10, 'Code must be exactly 10 characters')
  .regex(/^[a-zA-Z0-9]+$/, 'Code must contain only letters and numbers')

/**
 * Schema for WebSocket acknowledgment
 */
export const wsAcknowledgmentSchema = z.object({
  messageId: z.string().uuid(),
})
