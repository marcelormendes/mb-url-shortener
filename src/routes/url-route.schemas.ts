/**
 * Swagger/OpenAPI schemas for URL routes
 */

export const shortenUrlRequestSchema = {
  type: 'object',
  required: ['url'],
  properties: {
    url: {
      type: 'string',
      description: 'The URL to be shortened',
    },
  },
}

export const shortenUrlResponseSchemas = {
  200: {
    type: 'object',
    properties: {
      message: {
        type: 'string',
        description: 'Success message indicating URL was shortened and will be sent via WebSocket',
      },
    },
    example: {
      message: 'URL shortened successfully. Result will be sent via WebSocket.',
    },
  },
  400: {
    type: 'object',
    properties: {
      message: {
        type: 'string',
        description: 'Human-readable error message',
      },
      errorCode: {
        type: 'string',
        description: 'Machine-readable error code for programmatic handling',
      },
      details: {
        type: 'object',
        description: 'Additional error details and context',
      },
      timestamp: {
        type: 'string',
        format: 'date-time',
        description: 'ISO timestamp when the error occurred',
      },
    },
    example: {
      message: 'Validation error',
      errorCode: 'URL001',
      details: [{ message: 'Required', path: ['url'] }],
      timestamp: '2024-01-01T12:00:00.000Z',
    },
  },
  500: {
    type: 'object',
    properties: {
      message: {
        type: 'string',
        description: 'Human-readable error message',
      },
      errorCode: {
        type: 'string',
        description: 'Machine-readable error code for programmatic handling',
      },
      details: {
        type: 'object',
        description: 'Additional error details and context',
      },
      timestamp: {
        type: 'string',
        format: 'date-time',
        description: 'ISO timestamp when the error occurred',
      },
    },
    example: {
      message: 'Failed to generate unique code after 10 attempts',
      errorCode: 'URL003',
      details: { attempts: 10 },
      timestamp: '2024-01-01T12:00:00.000Z',
    },
  },
}

export const getUrlParamsSchema = {
  type: 'object',
  properties: {
    code: {
      type: 'string',
      pattern: '^[a-zA-Z0-9]{10}$',
      description: 'The 10-character alphanumeric code representing the shortened URL',
    },
  },
  required: ['code'],
}

export const getUrlResponseSchemas = {
  200: {
    type: 'object',
    properties: {
      url: {
        type: 'string',
        format: 'uri',
        description: 'The original URL that was shortened',
      },
    },
    example: {
      url: 'https://example.com/very/long/url',
    },
  },
  400: {
    type: 'object',
    properties: {
      message: {
        type: 'string',
        description: 'Human-readable error message',
      },
      errorCode: {
        type: 'string',
        description: 'Machine-readable error code for programmatic handling',
      },
      details: {
        type: 'object',
        description: 'Additional error details and context',
      },
      timestamp: {
        type: 'string',
        format: 'date-time',
        description: 'ISO timestamp when the error occurred',
      },
    },
    example: {
      message: 'Validation error',
      errorCode: 'URL001',
      details: [{ message: 'Invalid format', path: ['code'] }],
      timestamp: '2024-01-01T12:00:00.000Z',
    },
  },
  404: {
    type: 'object',
    properties: {
      message: {
        type: 'string',
        description: 'Human-readable error message',
      },
      errorCode: {
        type: 'string',
        description: 'Machine-readable error code for programmatic handling',
      },
      details: {
        type: 'object',
        description: 'Additional error details and context',
      },
      timestamp: {
        type: 'string',
        format: 'date-time',
        description: 'ISO timestamp when the error occurred',
      },
    },
    example: {
      message: 'URL code not found: abc123xyz0',
      errorCode: 'URL002',
      details: { code: 'abc123xyz0' },
      timestamp: '2024-01-01T12:00:00.000Z',
    },
  },
  500: {
    type: 'object',
    properties: {
      message: {
        type: 'string',
        description: 'Human-readable error message',
      },
      errorCode: {
        type: 'string',
        description: 'Machine-readable error code for programmatic handling',
      },
      details: {
        type: 'object',
        description: 'Additional error details and context',
      },
      timestamp: {
        type: 'string',
        format: 'date-time',
        description: 'ISO timestamp when the error occurred',
      },
    },
    example: {
      message: 'URL storage operation failed: get',
      errorCode: 'URL004',
      details: { operation: 'get' },
      timestamp: '2024-01-01T12:00:00.000Z',
    },
  },
}
