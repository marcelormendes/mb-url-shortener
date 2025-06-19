/**
 * Jest setup file for global test configuration
 */

// Increase timeout for async operations
jest.setTimeout(10000)

// Mock console.log and console.error to reduce noise in tests
const originalConsoleLog = console.log
const originalConsoleError = console.error

beforeAll(() => {
  console.log = jest.fn()
  console.error = jest.fn()
})

afterAll(() => {
  console.log = originalConsoleLog
  console.error = originalConsoleError
})
