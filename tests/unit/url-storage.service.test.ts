import { UrlStorageService } from '../../src/services/url-storage.service'
import { UrlException } from '../../src/services/url.exceptions'
import type { UrlMapping } from '../../src/types/url.types'

describe('UrlStorageService', () => {
  let service: UrlStorageService

  beforeEach(() => {
    service = new UrlStorageService()
  })

  describe('store', () => {
    it('should store a URL mapping successfully', async () => {
      const mapping: UrlMapping = {
        code: 'test123456',
        originalUrl: 'https://example.com',
        shortenedUrl: 'http://localhost:3000/test123456',
        createdAt: new Date(),
      }

      await expect(service.store(mapping)).resolves.toBeUndefined()
    })

    it('should handle storage errors gracefully', async () => {
      const mapping: UrlMapping = {
        code: 'test123456',
        originalUrl: 'https://example.com',
        shortenedUrl: 'http://localhost:3000/test123456',
        createdAt: new Date(),
      }

      // Mock setTimeout to throw an error
      const originalSetTimeout = global.setTimeout

      global.setTimeout = jest.fn().mockImplementation(() => {
        throw new Error('Storage error')
      }) as any

      await expect(service.store(mapping)).rejects.toThrow(UrlException)
      await expect(service.store(mapping)).rejects.toThrow('URL storage operation failed: store')

      global.setTimeout = originalSetTimeout
    })
  })

  describe('get', () => {
    it('should retrieve a stored URL mapping', async () => {
      const mapping: UrlMapping = {
        code: 'test123456',
        originalUrl: 'https://example.com',
        shortenedUrl: 'http://localhost:3000/test123456',
        createdAt: new Date(),
      }

      await service.store(mapping)
      const result = await service.get('test123456')

      expect(result).toEqual(mapping)
    })

    it('should return null for non-existent code', async () => {
      const result = await service.get('nonexistent')
      expect(result).toBeNull()
    })

    it('should handle retrieval errors gracefully', async () => {
      // Mock setTimeout to throw an error
      const originalSetTimeout = global.setTimeout
      global.setTimeout = jest.fn().mockImplementation(() => {
        throw new Error('Retrieval error')
      }) as any

      await expect(service.get('test123456')).rejects.toThrow(UrlException)
      await expect(service.get('test123456')).rejects.toThrow('URL storage operation failed: get')

      global.setTimeout = originalSetTimeout
    })
  })

  describe('exists', () => {
    it('should return true for existing code', async () => {
      const mapping: UrlMapping = {
        code: 'test123456',
        originalUrl: 'https://example.com',
        shortenedUrl: 'http://localhost:3000/test123456',
        createdAt: new Date(),
      }

      await service.store(mapping)
      const exists = await service.exists('test123456')

      expect(exists).toBe(true)
    })

    it('should return false for non-existent code', async () => {
      const exists = await service.exists('nonexistent')
      expect(exists).toBe(false)
    })

    it('should handle existence check errors gracefully', async () => {
      // Mock setTimeout to throw an error
      const originalSetTimeout = global.setTimeout
      global.setTimeout = jest.fn().mockImplementation(() => {
        throw new Error('Existence check error')
      }) as any

      await expect(service.exists('test123456')).rejects.toThrow(UrlException)
      await expect(service.exists('test123456')).rejects.toThrow(
        'URL storage operation failed: exists',
      )

      global.setTimeout = originalSetTimeout
    })
  })

  describe('concurrent operations', () => {
    it('should handle multiple concurrent store operations', async () => {
      const mappings: UrlMapping[] = Array.from({ length: 10 }, (_, i) => ({
        code: `test${i.toString().padStart(6, '0')}`,
        originalUrl: `https://example${i}.com`,
        shortenedUrl: `http://localhost:3000/test${i.toString().padStart(6, '0')}`,
        createdAt: new Date(),
      }))

      const storePromises = mappings.map((mapping) => service.store(mapping))
      await expect(Promise.all(storePromises)).resolves.toEqual(Array(10).fill(undefined))

      // Verify all mappings were stored
      for (const mapping of mappings) {
        const result = await service.get(mapping.code)
        expect(result).toEqual(mapping)
      }
    })

    it('should handle concurrent read operations', async () => {
      const mapping: UrlMapping = {
        code: 'test123456',
        originalUrl: 'https://example.com',
        shortenedUrl: 'http://localhost:3000/test123456',
        createdAt: new Date(),
      }

      await service.store(mapping)

      const readPromises = Array.from({ length: 10 }, () => service.get('test123456'))
      const results = await Promise.all(readPromises)

      results.forEach((result) => {
        expect(result).toEqual(mapping)
      })
    })
  })
})
