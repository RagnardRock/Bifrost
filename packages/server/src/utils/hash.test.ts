import { describe, it, expect } from 'vitest'
import { hashPassword, comparePassword } from './hash'

describe('hash utilities', () => {
  describe('hashPassword', () => {
    it('should hash a password', async () => {
      const password = 'testPassword123'
      const hash = await hashPassword(password)

      expect(hash).toBeTruthy()
      expect(hash).not.toBe(password)
      expect(hash.length).toBeGreaterThan(50)
    })

    it('should generate different hashes for same password', async () => {
      const password = 'testPassword123'
      const hash1 = await hashPassword(password)
      const hash2 = await hashPassword(password)

      expect(hash1).not.toBe(hash2)
    })

    it('should generate bcrypt format hash', async () => {
      const password = 'testPassword123'
      const hash = await hashPassword(password)

      // bcrypt hash starts with $2b$ or $2a$
      expect(hash).toMatch(/^\$2[ab]\$/)
    })
  })

  describe('comparePassword', () => {
    it('should return true for matching password', async () => {
      const password = 'testPassword123'
      const hash = await hashPassword(password)

      const result = await comparePassword(password, hash)
      expect(result).toBe(true)
    })

    it('should return false for non-matching password', async () => {
      const password = 'testPassword123'
      const wrongPassword = 'wrongPassword456'
      const hash = await hashPassword(password)

      const result = await comparePassword(wrongPassword, hash)
      expect(result).toBe(false)
    })

    it('should handle empty password', async () => {
      const password = ''
      const hash = await hashPassword(password)

      const result = await comparePassword(password, hash)
      expect(result).toBe(true)

      const wrongResult = await comparePassword('notEmpty', hash)
      expect(wrongResult).toBe(false)
    })

    it('should handle special characters in password', async () => {
      const password = 'P@$$w0rd!#$%^&*()_+-=[]{}|;:,.<>?'
      const hash = await hashPassword(password)

      const result = await comparePassword(password, hash)
      expect(result).toBe(true)
    })

    it('should handle unicode characters in password', async () => {
      const password = 'motdepasse日本語🔐'
      const hash = await hashPassword(password)

      const result = await comparePassword(password, hash)
      expect(result).toBe(true)
    })
  })
})
