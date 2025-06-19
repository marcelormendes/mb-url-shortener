/**
 * Mock for nanoid package
 */

// Mock nanoid to return a deterministic value for tests
export const nanoid = jest.fn().mockImplementation(() => {
  // Return a random alphanumeric string for both unit and E2E tests
  const alphabet = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'
  let result = ''
  for (let i = 0; i < 21; i++) {
    // Standard nanoid length
    result += alphabet.charAt(Math.floor(Math.random() * alphabet.length))
  }
  return result
})

// For E2E tests, provide a real implementation that works
const realCustomAlphabet = jest.fn().mockImplementation((alphabet: string, size: number) => {
  return jest.fn().mockImplementation(() => {
    let result = ''
    for (let i = 0; i < size; i++) {
      result += alphabet.charAt(Math.floor(Math.random() * alphabet.length))
    }
    return result
  })
})

export const customAlphabet = realCustomAlphabet
