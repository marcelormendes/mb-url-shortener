import { customAlphabet } from 'nanoid'
import { env } from '../config/env.js'
import type { UrlMapping } from '../types/url.types.js'
import { UrlException } from './url.exceptions.js'
import { UrlStorageService } from './url-storage.service.js'

/**
 * Service for shortening URLs
 */
export class UrlShortenerService {
  private readonly nanoid: () => string

  constructor(private readonly storageService: UrlStorageService) {
    // Create nanoid with alphanumeric characters only (no dashes or underscores)
    this.nanoid = customAlphabet(
      '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz',
      10,
    )
  }

  /**
   * Shortens a URL and returns the mapping
   */
  async shortenUrl(originalUrl: string): Promise<UrlMapping> {
    const code = await this.generateUniqueCode()
    const shortenedUrl = `${env.BASE_URL}/${code}`

    const mapping: UrlMapping = {
      code,
      originalUrl,
      shortenedUrl,
      createdAt: new Date(),
    }

    await this.storageService.store(mapping)
    return mapping
  }

  /**
   * Generates a unique code using cryptographically secure random generation
   * Production-ready approach with collision handling and monitoring
   */
  private async generateUniqueCode(): Promise<string> {
    const maxAttempts = 10

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const code = this.nanoid()

      const exists = await this.storageService.exists(code)
      if (!exists) {
        // Log collision rate for monitoring (important for production)
        if (attempt > 1) {
          console.warn(`Code collision detected, resolved after ${attempt} attempts`)
        }
        return code
      }
    }

    // In production, this should trigger alerts/monitoring
    console.error(
      `Failed to generate unique code after ${maxAttempts} attempts - possible system issue`,
    )
    throw new UrlException('URL003', 500, { attempts: maxAttempts })
  }
}
