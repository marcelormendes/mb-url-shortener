import { UrlShortenerService } from '../../src/services/url/url-shortener.service'
import { UrlStorageService } from '../../src/services/url/url-storage.service'
import { UrlException } from '../../src/services/url/url.exceptions'

// Mock nanoid
jest.mock('nanoid', () => ({
  customAlphabet: jest.fn(),
}))

import { customAlphabet } from 'nanoid'
const mockCustomAlphabet = customAlphabet as jest.MockedFunction<typeof customAlphabet>
const mockNanoidFunction = jest.fn()

describe('UrlShortenerService', () => {
  let service: UrlShortenerService
  let mockStorageService: jest.Mocked<UrlStorageService>

  beforeEach(() => {
    mockStorageService = {
      store: jest.fn(),
      get: jest.fn(),
      exists: jest.fn(),
      storage: new Map(),
    } as unknown as jest.Mocked<UrlStorageService>

    // Reset and setup nanoid mock
    mockCustomAlphabet.mockClear()
    mockNanoidFunction.mockClear()
    mockCustomAlphabet.mockReturnValue(mockNanoidFunction)

    service = new UrlShortenerService(mockStorageService)
  })

  describe('shortenUrl', () => {
    it('should successfully shorten a URL', async () => {
      const testUrl = 'https://example.com/very/long/url'
      const testCode = 'abc123xyz0'

      mockNanoidFunction.mockReturnValue(testCode)
      mockStorageService.exists.mockResolvedValue(false)
      mockStorageService.store.mockResolvedValue()

      const result = await service.shortenUrl(testUrl)

      expect(result).toEqual({
        code: testCode,
        originalUrl: testUrl,
        shortenedUrl: `http://localhost:3000/${testCode}`,
        createdAt: expect.any(Date),
      })

      expect(mockNanoidFunction).toHaveBeenCalledWith()
      expect(mockStorageService.exists).toHaveBeenCalledWith(testCode)
      expect(mockStorageService.store).toHaveBeenCalledWith(result)
    })

    it('should generate a new code if the first one exists', async () => {
      const testUrl = 'https://example.com/test'
      const existingCode = 'existing123'
      const newCode = 'newcode456'

      mockNanoidFunction.mockReturnValueOnce(existingCode).mockReturnValueOnce(newCode)

      mockStorageService.exists
        .mockResolvedValueOnce(true) // First code exists
        .mockResolvedValueOnce(false) // Second code doesn't exist

      mockStorageService.store.mockResolvedValue()

      const result = await service.shortenUrl(testUrl)

      expect(result.code).toBe(newCode)
      expect(mockNanoidFunction).toHaveBeenCalledTimes(2)
      expect(mockStorageService.exists).toHaveBeenCalledTimes(2)
      expect(mockStorageService.exists).toHaveBeenNthCalledWith(1, existingCode)
      expect(mockStorageService.exists).toHaveBeenNthCalledWith(2, newCode)
    })

    it('should throw UrlException if unable to generate unique code after max attempts', async () => {
      const testUrl = 'https://example.com/test'
      const testCode = 'samecode12'

      mockNanoidFunction.mockReturnValue(testCode)
      mockStorageService.exists.mockResolvedValue(true) // All codes exist

      await expect(service.shortenUrl(testUrl)).rejects.toThrow(UrlException)
      await expect(service.shortenUrl(testUrl)).rejects.toThrow(
        'Failed to generate unique code after 10 attempts',
      )

      expect(mockNanoidFunction).toHaveBeenCalledTimes(20) // Called twice (10 + 10)
      expect(mockStorageService.exists).toHaveBeenCalledTimes(20) // Called twice (10 + 10)
      expect(mockStorageService.store).not.toHaveBeenCalled()
    })

    it('should handle storage errors', async () => {
      const testUrl = 'https://example.com/test'
      const testCode = 'abc123xyz0'

      mockNanoidFunction.mockReturnValue(testCode)
      mockStorageService.exists.mockResolvedValue(false)
      mockStorageService.store.mockRejectedValue(new Error('Storage failed'))

      await expect(service.shortenUrl(testUrl)).rejects.toThrow('Storage failed')

      expect(mockStorageService.store).toHaveBeenCalledTimes(1)
    })

    it('should handle exists check errors', async () => {
      const testUrl = 'https://example.com/test'
      const testCode = 'abc123xyz0'

      mockNanoidFunction.mockReturnValue(testCode)
      mockStorageService.exists.mockRejectedValue(new Error('Exists check failed'))

      await expect(service.shortenUrl(testUrl)).rejects.toThrow('Exists check failed')

      expect(mockStorageService.exists).toHaveBeenCalledTimes(1)
      expect(mockStorageService.store).not.toHaveBeenCalled()
    })
  })

  describe('generateUniqueCode', () => {
    it('should retry code generation when codes collide', async () => {
      const testUrl = 'https://example.com/test'
      const codes = ['code1', 'code2', 'code3', 'code4', 'code5']

      // Mock first 4 codes as existing, 5th as unique
      codes.forEach((code, index) => {
        mockNanoidFunction.mockReturnValueOnce(code)
        mockStorageService.exists.mockResolvedValueOnce(index < 4)
      })

      mockStorageService.store.mockResolvedValue()

      const result = await service.shortenUrl(testUrl)

      expect(result.code).toBe('code5')
      expect(mockNanoidFunction).toHaveBeenCalledTimes(5)
      expect(mockStorageService.exists).toHaveBeenCalledTimes(5)
    })
  })

  describe('concurrent operations', () => {
    it('should handle multiple concurrent URL shortening requests', async () => {
      const urls = [
        'https://example1.com',
        'https://example2.com',
        'https://example3.com',
        'https://example4.com',
        'https://example5.com',
      ]

      const codes = ['code1', 'code2', 'code3', 'code4', 'code5']

      codes.forEach((code) => {
        mockNanoidFunction.mockReturnValueOnce(code)
      })

      mockStorageService.exists.mockResolvedValue(false)
      mockStorageService.store.mockResolvedValue()

      const promises = urls.map((url) => service.shortenUrl(url))
      const results = await Promise.all(promises)

      expect(results).toHaveLength(5)
      results.forEach((result, index) => {
        expect(result.code).toBe(codes[index])
        expect(result.originalUrl).toBe(urls[index])
        expect(result.shortenedUrl).toBe(`http://localhost:3000/${codes[index]}`)
      })

      expect(mockStorageService.store).toHaveBeenCalledTimes(5)
    })
  })

  describe('edge cases', () => {
    it('should handle very long URLs', async () => {
      const longUrl = 'https://example.com/' + 'a'.repeat(2000)
      const testCode = 'abc123xyz0'

      mockNanoidFunction.mockReturnValue(testCode)
      mockStorageService.exists.mockResolvedValue(false)
      mockStorageService.store.mockResolvedValue()

      const result = await service.shortenUrl(longUrl)

      expect(result.originalUrl).toBe(longUrl)
      expect(result.code).toBe(testCode)
    })

    it('should handle URLs with special characters', async () => {
      const specialUrl = 'https://example.com/path?query=value&param=test#fragment'
      const testCode = 'abc123xyz0'

      mockNanoidFunction.mockReturnValue(testCode)
      mockStorageService.exists.mockResolvedValue(false)
      mockStorageService.store.mockResolvedValue()

      const result = await service.shortenUrl(specialUrl)

      expect(result.originalUrl).toBe(specialUrl)
      expect(result.code).toBe(testCode)
    })
  })
})
