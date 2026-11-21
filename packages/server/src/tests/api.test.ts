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
      expect(response.body.data.message).toBe('Bifrost API')
      expect(response.body.data.version).toBe('0.2.0')
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

  describe('POST /api/comptes/connexion', () => {
    it('should reject empty body', async () => {
      const response = await request(app).post('/api/comptes/connexion').send({})

      expect(response.status).toBe(400)
      expect(response.body.success).toBe(false)
    })

    it('should reject invalid email format', async () => {
      const response = await request(app)
        .post('/api/comptes/connexion')
        .send({ email: 'pas-un-email', motDePasse: 'x' })

      expect(response.status).toBe(400)
      expect(response.body.success).toBe(false)
    })
  })
})

describe('Protected Routes - Authentication', () => {
  describe('GET /api/admin/suivi/sites', () => {
    it('should reject request without token', async () => {
      const response = await request(app).get('/api/admin/suivi/sites')

      expect(response.status).toBe(401)
      expect(response.body.success).toBe(false)
    })

    it('should reject request with invalid token', async () => {
      const response = await request(app)
        .get('/api/admin/suivi/sites')
        .set('Authorization', 'Bearer invalid-token')

      expect(response.status).toBe(401)
      expect(response.body.success).toBe(false)
    })

    it('should reject malformed authorization header', async () => {
      const response = await request(app)
        .get('/api/admin/suivi/sites')
        .set('Authorization', 'NotBearer token')

      expect(response.status).toBe(401)
      expect(response.body.success).toBe(false)
    })
  })

  describe('GET /api/editeur/:siteId', () => {
    it('should reject request without token', async () => {
      const response = await request(app).get('/api/editeur/00000000-0000-0000-0000-000000000000')

      expect(response.status).toBe(401)
      expect(response.body.success).toBe(false)
    })
  })

  describe('GET /apercu/:siteId', () => {
    it('should reject preview without cookie', async () => {
      const response = await request(app).get('/apercu/00000000-0000-0000-0000-000000000000/index.html')

      expect(response.status).toBe(401)
    })
  })
})

describe('API des outils du dev (Rune)', () => {
  it('refuse sans connexion', async () => {
    const r = await request(app).get('/api/dev/sites')
    expect(r.status).toBe(401)
  })
  it('refuse un jeton inconnu', async () => {
    const r = await request(app).get('/api/dev/sites').set('Authorization', 'Bearer pas-un-jeton')
    expect(r.status).toBe(401)
  })
  it('vérifie la connexion', async () => {
    const r = await request(app).post('/api/dev/connexion').send({ email: 'pas-un-email' })
    expect(r.status).toBe(400)
  })
})
