import { describe, it, expect } from 'vitest'
import request from 'supertest'
import { app } from '../app'

describe('API Basic Routes', () => {
  describe('GET /health', () => {
    it('should return health status', async () => {
      const response = await request(app).get('/health')

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.data.status).toBe('healthy')
      expect(response.body.data.timestamp).toBeDefined()
    })
  })

  describe('GET /api', () => {
    it('should return API info', async () => {
      const response = await request(app).get('/api')

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.data.message).toBe('Bifrost API v1')
      expect(response.body.data.version).toBe('0.1.0')
    })
  })

  describe('404 Handler', () => {
    it('should return 404 for unknown routes', async () => {
      const response = await request(app).get('/unknown-route')

      expect(response.status).toBe(404)
      expect(response.body.success).toBe(false)
      expect(response.body.error.code).toBe('NOT_FOUND')
    })
  })
})

describe('Auth Routes - Input Validation', () => {
  describe('POST /api/auth/admin/login', () => {
    it('should reject empty body', async () => {
      const response = await request(app)
        .post('/api/auth/admin/login')
        .send({})

      expect(response.status).toBe(400)
      expect(response.body.success).toBe(false)
    })

    it('should reject missing password', async () => {
      const response = await request(app)
        .post('/api/auth/admin/login')
        .send({ email: 'admin@test.com' })

      expect(response.status).toBe(400)
      expect(response.body.success).toBe(false)
    })

    it('should reject missing email', async () => {
      const response = await request(app)
        .post('/api/auth/admin/login')
        .send({ password: 'password123' })

      expect(response.status).toBe(400)
      expect(response.body.success).toBe(false)
    })

    it('should reject invalid email format', async () => {
      const response = await request(app)
        .post('/api/auth/admin/login')
        .send({ email: 'not-an-email', password: 'password123' })

      expect(response.status).toBe(400)
      expect(response.body.success).toBe(false)
    })
  })

  describe('POST /api/auth/client/login', () => {
    it('should reject empty body', async () => {
      const response = await request(app)
        .post('/api/auth/client/login')
        .send({})

      expect(response.status).toBe(400)
      expect(response.body.success).toBe(false)
    })

    it('should reject missing siteId', async () => {
      const response = await request(app)
        .post('/api/auth/client/login')
        .send({ email: 'client@test.com', password: 'password123' })

      expect(response.status).toBe(400)
      expect(response.body.success).toBe(false)
    })
  })
})

describe('Protected Routes - Authentication', () => {
  describe('GET /api/admin/sites', () => {
    it('should reject request without token', async () => {
      const response = await request(app).get('/api/admin/sites')

      expect(response.status).toBe(401)
      expect(response.body.success).toBe(false)
    })

    it('should reject request with invalid token', async () => {
      const response = await request(app)
        .get('/api/admin/sites')
        .set('Authorization', 'Bearer invalid-token')

      expect(response.status).toBe(401)
      expect(response.body.success).toBe(false)
    })

    it('should reject malformed authorization header', async () => {
      const response = await request(app)
        .get('/api/admin/sites')
        .set('Authorization', 'NotBearer token')

      expect(response.status).toBe(401)
      expect(response.body.success).toBe(false)
    })
  })

  describe('GET /api/admin/stats', () => {
    it('should reject request without token', async () => {
      const response = await request(app).get('/api/admin/stats')

      expect(response.status).toBe(401)
      expect(response.body.success).toBe(false)
    })
  })

  describe('GET /api/client/content', () => {
    it('should reject request without token', async () => {
      const response = await request(app).get('/api/client/content')

      expect(response.status).toBe(401)
      expect(response.body.success).toBe(false)
    })
  })
})

describe('Public API - Authentication', () => {
  describe('GET /api/public/content', () => {
    it('should reject request without API key', async () => {
      const response = await request(app).get('/api/public/content')

      expect(response.status).toBe(401)
      expect(response.body.success).toBe(false)
    })

    it('should reject request with empty API key', async () => {
      const response = await request(app)
        .get('/api/public/content')
        .set('X-API-Key', '')

      expect(response.status).toBe(401)
      expect(response.body.success).toBe(false)
    })
  })
})
