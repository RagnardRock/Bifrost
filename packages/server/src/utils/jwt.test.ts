import { describe, it, expect } from 'vitest'
import { signToken, verifyToken, decodeToken } from './jwt'

describe('jwt utilities', () => {
  describe('signToken', () => {
    it('should sign an admin token', () => {
      const payload = {
        adminId: 'admin-123',
        role: 'admin' as const,
      }

      const token = signToken(payload)

      expect(token).toBeTruthy()
      expect(typeof token).toBe('string')
      expect(token.split('.')).toHaveLength(3) // JWT format: header.payload.signature
    })

    it('should sign a client token', () => {
      const payload = {
        userId: 'user-123',
        siteId: 'site-456',
        role: 'client' as const,
      }

      const token = signToken(payload)

      expect(token).toBeTruthy()
      expect(token.split('.')).toHaveLength(3)
    })

    it('should create different tokens for different payloads', () => {
      const token1 = signToken({ adminId: 'admin-1', role: 'admin' as const })
      const token2 = signToken({ adminId: 'admin-2', role: 'admin' as const })

      expect(token1).not.toBe(token2)
    })
  })

  describe('verifyToken', () => {
    it('should verify and decode a valid admin token', () => {
      const payload = {
        adminId: 'admin-123',
        role: 'admin' as const,
      }

      const token = signToken(payload)
      const decoded = verifyToken(token)

      expect(decoded.adminId).toBe(payload.adminId)
      expect(decoded.role).toBe(payload.role)
      expect(decoded.iat).toBeDefined()
      expect(decoded.exp).toBeDefined()
    })

    it('should verify and decode a valid client token', () => {
      const payload = {
        userId: 'user-123',
        siteId: 'site-456',
        role: 'client' as const,
      }

      const token = signToken(payload)
      const decoded = verifyToken(token)

      expect(decoded.userId).toBe(payload.userId)
      expect(decoded.siteId).toBe(payload.siteId)
      expect(decoded.role).toBe(payload.role)
    })

    it('should throw on invalid token', () => {
      expect(() => verifyToken('invalid-token')).toThrow()
    })

    it('should throw on tampered token', () => {
      const token = signToken({ adminId: 'admin-123', role: 'admin' as const })
      const tamperedToken = token.slice(0, -5) + 'xxxxx'

      expect(() => verifyToken(tamperedToken)).toThrow()
    })

    it('should throw on empty token', () => {
      expect(() => verifyToken('')).toThrow()
    })
  })

  describe('decodeToken', () => {
    it('should decode a valid token without verification', () => {
      const payload = {
        adminId: 'admin-123',
        role: 'admin' as const,
      }

      const token = signToken(payload)
      const decoded = decodeToken(token)

      expect(decoded).not.toBeNull()
      expect(decoded?.adminId).toBe(payload.adminId)
      expect(decoded?.role).toBe(payload.role)
    })

    it('should return null for invalid token', () => {
      const result = decodeToken('not-a-valid-token')
      expect(result).toBeNull()
    })

    it('should return null for empty token', () => {
      const result = decodeToken('')
      expect(result).toBeNull()
    })

    it('should decode token without verifying signature', () => {
      const token = signToken({ adminId: 'admin-123', role: 'admin' as const })
      // Tamper with signature
      const parts = token.split('.')
      parts[2] = 'invalid-signature'
      const tamperedToken = parts.join('.')

      // decodeToken should still work (it doesn't verify)
      const decoded = decodeToken(tamperedToken)
      expect(decoded?.adminId).toBe('admin-123')
    })
  })

  describe('token expiration', () => {
    it('should set expiration for admin tokens', () => {
      const token = signToken({ adminId: 'admin-123', role: 'admin' as const })
      const decoded = verifyToken(token)

      // Admin tokens should expire in 7 days
      const expectedExpiry = decoded.iat! + 7 * 24 * 60 * 60
      expect(decoded.exp).toBe(expectedExpiry)
    })

    it('should set expiration for client tokens', () => {
      const token = signToken({
        userId: 'user-123',
        siteId: 'site-456',
        role: 'client' as const,
      })
      const decoded = verifyToken(token)

      // Client tokens should expire in 24 hours
      const expectedExpiry = decoded.iat! + 24 * 60 * 60
      expect(decoded.exp).toBe(expectedExpiry)
    })
  })
})
