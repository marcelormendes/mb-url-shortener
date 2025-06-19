import { CustomException } from '../../src/utils/custom.exceptions'
import { UrlException, errorCodes } from '../../src/services/url.exceptions'

describe('CustomException', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('constructor', () => {
    it('should create exception with required properties', () => {
      const errorCode = 'TEST001'
      const message = 'Test error message'
      const statusCode = 400
      const details = { userId: '123' }

      const exception = new CustomException(errorCode, message, statusCode, details)

      expect(exception.errorCode).toBe(errorCode)
      expect(exception.message).toBe(message)
      expect(exception.statusCode).toBe(statusCode)
      expect(exception.details).toBe(details)
      expect(exception.timestamp).toBeDefined()
      expect(exception.name).toBe('CustomException')
    })

    it('should use default status code 500 when not provided', () => {
      const exception = new CustomException('TEST001', 'Test message')

      expect(exception.statusCode).toBe(500)
    })

    it('should handle undefined details', () => {
      const exception = new CustomException('TEST001', 'Test message', 400)

      expect(exception.details).toBeUndefined()
    })

    it('should have valid timestamp', () => {
      const before = new Date()
      const exception = new CustomException('TEST001', 'Test message')
      const after = new Date()

      const timestamp = new Date(exception.timestamp)
      expect(timestamp.getTime()).toBeGreaterThanOrEqual(before.getTime())
      expect(timestamp.getTime()).toBeLessThanOrEqual(after.getTime())
    })
  })

  describe('toJSON', () => {
    it('should return correct JSON representation', () => {
      const errorCode = 'TEST001'
      const message = 'Test error message'
      const statusCode = 400
      const details = { userId: '123', action: 'test' }

      const exception = new CustomException(errorCode, message, statusCode, details)
      const json = exception.toJSON()

      expect(json).toEqual({
        message,
        errorCode,
        details,
        timestamp: exception.timestamp,
      })
    })

    it('should handle undefined details in JSON', () => {
      const exception = new CustomException('TEST001', 'Test message')
      const json = exception.toJSON()

      expect(json.details).toBeUndefined()
      expect(json).toHaveProperty('message')
      expect(json).toHaveProperty('errorCode')
      expect(json).toHaveProperty('timestamp')
    })
  })

  describe('inheritance', () => {
    it('should be instance of Error', () => {
      const exception = new CustomException('TEST001', 'Test message')

      expect(exception).toBeInstanceOf(Error)
      expect(exception).toBeInstanceOf(CustomException)
    })

    it('should have correct stack trace', () => {
      const exception = new CustomException('TEST001', 'Test message')

      expect(exception.stack).toBeDefined()
      expect(exception.stack).toContain('CustomException')
    })
  })
})

describe('UrlException', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    // Mock console.error
    jest.spyOn(console, 'error').mockImplementation(() => {})
  })

  describe('constructor', () => {
    it('should create exception with template message interpolation', () => {
      const exception = new UrlException('URL002', 404, { code: 'abc123xyz0' })

      expect(exception.errorCode).toBe('URL002')
      expect(exception.message).toBe('URL code not found: abc123xyz0')
      expect(exception.statusCode).toBe(404)
      expect(exception.details).toEqual({ code: 'abc123xyz0' })
    })

    it('should handle multiple placeholder replacements', () => {
      const exception = new UrlException('URL003', 500, { attempts: 10 })

      expect(exception.message).toBe('Failed to generate unique code after 10 attempts')
      expect(exception.details).toEqual({ attempts: 10 })
    })

    it('should work without details', () => {
      const exception = new UrlException('URL002', 404)

      expect(exception.message).toBe('URL code not found: {code}')
      expect(exception.details).toBeUndefined()
    })

    it('should log error with details', () => {
      const details = { code: 'test-code' }
      new UrlException('URL002', 404, details)

      expect(console.error).toHaveBeenCalledWith(
        'ERROR URL002: URL code not found: test-code',
        details,
      )
    })
  })

  describe('error codes', () => {
    it('should have all expected error codes defined', () => {
      expect(errorCodes.URL002).toBe('URL code not found: {code}')
      expect(errorCodes.URL003).toBe('Failed to generate unique code after {attempts} attempts')
      expect(errorCodes.URL004).toBe('URL storage operation failed: {operation}')
    })

    it('should freeze error codes object', () => {
      expect(Object.isFrozen(errorCodes)).toBe(true)
    })
  })

  describe('message interpolation', () => {
    it('should replace single placeholder', () => {
      const exception = new UrlException('URL002', 404, { code: 'abc123xyz0' })

      expect(exception.message).toBe('URL code not found: abc123xyz0')
    })

    it('should replace multiple placeholders', () => {
      const exception = new UrlException('URL004', 500, { operation: 'store' })

      expect(exception.message).toBe('URL storage operation failed: store')
    })

    it('should handle special characters in replacements', () => {
      const exception = new UrlException('URL004', 500, {
        operation: 'store-with-special-chars',
      })

      expect(exception.message).toBe('URL storage operation failed: store-with-special-chars')
    })

    it('should handle numeric values', () => {
      const exception = new UrlException('URL003', 500, { attempts: 5 })

      expect(exception.message).toBe('Failed to generate unique code after 5 attempts')
    })

    it('should handle boolean values', () => {
      const exception = new UrlException('URL004', 500, { operation: 'exists', success: false })

      expect(exception.message).toBe('URL storage operation failed: exists')
    })
  })

  describe('inheritance', () => {
    it('should be instance of CustomException and Error', () => {
      const exception = new UrlException('URL002', 404)

      expect(exception).toBeInstanceOf(Error)
      expect(exception).toBeInstanceOf(CustomException)
      expect(exception).toBeInstanceOf(UrlException)
    })

    it('should have correct name', () => {
      const exception = new UrlException('URL002', 404)

      expect(exception.name).toBe('UrlException')
    })
  })

  describe('toJSON compatibility', () => {
    it('should serialize correctly', () => {
      const exception = new UrlException('URL002', 404, { code: 'abc123xyz0' })
      const json = exception.toJSON()

      expect(json).toEqual({
        message: 'URL code not found: abc123xyz0',
        errorCode: 'URL002',
        details: { code: 'abc123xyz0' },
        timestamp: exception.timestamp,
      })
    })
  })

  describe('edge cases', () => {
    it('should handle empty details object', () => {
      const exception = new UrlException('URL002', 404, {})

      expect(exception.message).toBe('URL code not found: {code}')
      expect(exception.details).toEqual({})
    })

    it('should handle null values in details', () => {
      const exception = new UrlException('URL002', 404, { code: null })

      expect(exception.message).toBe('URL code not found: null')
    })

    it('should handle undefined values in details', () => {
      const exception = new UrlException('URL002', 404, { code: undefined })

      expect(exception.message).toBe('URL code not found: undefined')
    })

    it('should handle details with no matching placeholders', () => {
      const exception = new UrlException('URL004', 500, { irrelevant: 'data', operation: 'test' })

      expect(exception.message).toBe('URL storage operation failed: test')
      expect(exception.details).toEqual({ irrelevant: 'data', operation: 'test' })
    })
  })
})
