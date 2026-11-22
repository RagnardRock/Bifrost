import { describe, it, expect } from 'vitest'
import express from 'express'
import cookieParser from 'cookie-parser'
import request from 'supertest'
import { authMiddleware } from './auth.middleware'
import { errorMiddleware } from './error.middleware'
import { signToken } from '../utils/jwt'

// Petite appli d'essai : une route lue, une route qui modifie, une route ouverte aux sessions limitées
const app = express()
app.use(cookieParser())
app.get('/api/editeur/x', authMiddleware, (req, res) => res.json({ ok: true, role: req.user?.role }))
app.post('/api/editeur/x', authMiddleware, (_req, res) => res.json({ ok: true }))
app.get('/api/auth/me', authMiddleware, (_req, res) => res.json({ ok: true }))
app.use(errorMiddleware)

const client = signToken({ userId: 'u1', siteId: 's1', role: 'client' })
const limite = signToken({ adminId: 'a1', role: 'admin', portee: 'double-auth' })

describe('session par cookie', () => {
  it('lit le jeton dans le cookie', async () => {
    const r = await request(app).get('/api/editeur/x').set('Cookie', `bf_session=${client}`)
    expect(r.status).toBe(200)
    expect(r.body.role).toBe('client')
  })

  it('refuse une modification par cookie sans l’en-tête de l’interface (CSRF)', async () => {
    const r = await request(app).post('/api/editeur/x').set('Cookie', `bf_session=${client}`)
    expect(r.status).toBe(403)
    const ok = await request(app).post('/api/editeur/x').set('Cookie', `bf_session=${client}`).set('X-Bifrost', '1')
    expect(ok.status).toBe(200)
  })

  it('accepte encore l’en-tête Authorization et le passe dans le cookie', async () => {
    const r = await request(app).get('/api/editeur/x').set('Authorization', `Bearer ${client}`).set('X-Bifrost', '1')
    expect(r.status).toBe(200)
    expect(String(r.headers['set-cookie'])).toMatch(/bf_session=.*HttpOnly.*SameSite=Strict/i)
  })

  it('retire un cookie invalide', async () => {
    const r = await request(app).get('/api/editeur/x').set('Cookie', 'bf_session=abc')
    expect(r.status).toBe(401)
    expect(String(r.headers['set-cookie'])).toMatch(/bf_session=;/)
  })
})

describe('double authentification obligatoire du dev', () => {
  it('une session limitée n’ouvre que « Mon compte »', async () => {
    const r = await request(app).get('/api/editeur/x').set('Cookie', `bf_session=${limite}`)
    expect(r.status).toBe(403)
    expect(r.body.error.code).toBe('DOUBLE_AUTH_A_ACTIVER')
    const me = await request(app).get('/api/auth/me').set('Cookie', `bf_session=${limite}`)
    expect(me.status).toBe(200)
  })
})
