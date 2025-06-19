import type { UrlMapping } from '../../types/url.types.js'
import { UrlException } from './url.exceptions.js'

/**
 * In-memory storage service for URL mappings
 */
export class UrlStorageService {
  private storage: Map<string, UrlMapping> = new Map()

  /**
   * Stores a URL mapping
   */
  async store(mapping: UrlMapping): Promise<void> {
    try {
      await new Promise((resolve) => setTimeout(resolve, 10))
      this.storage.set(mapping.code, mapping)
    } catch (error) {
      throw new UrlException('URL004', 500, { operation: 'store', error })
    }
  }

  /**
   * Retrieves a URL mapping by code
   */
  async get(code: string): Promise<UrlMapping | null> {
    try {
      await new Promise((resolve) => setTimeout(resolve, 10))
      return this.storage.get(code) || null
    } catch (error) {
      throw new UrlException('URL004', 500, { operation: 'get', error })
    }
  }

  /**
   * Checks if a code already exists
   */
  async exists(code: string): Promise<boolean> {
    try {
      await new Promise((resolve) => setTimeout(resolve, 5))
      return this.storage.has(code)
    } catch (error) {
      throw new UrlException('URL004', 500, { operation: 'exists', error })
    }
  }
}
