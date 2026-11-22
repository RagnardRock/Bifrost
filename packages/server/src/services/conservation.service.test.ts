import { describe, it, expect, afterEach } from 'vitest'
import { durees, limite } from './conservation.service'

describe('conservation des données', () => {
  afterEach(() => { delete process.env.CONSERVATION_MESSAGES_MOIS })

  it('garde les messages 12 mois et le journal 24 mois par défaut', () => {
    expect(durees().messages).toBe(12)
    expect(durees().journal).toBe(24)
  })

  it('suit le réglage du .env, et ignore une valeur absurde', () => {
    process.env.CONSERVATION_MESSAGES_MOIS = '6'
    expect(durees().messages).toBe(6)
    process.env.CONSERVATION_MESSAGES_MOIS = 'abc'
    expect(durees().messages).toBe(12)
  })

  it('calcule la date limite en mois', () => {
    expect(limite(12, new Date('2027-03-15T10:00:00Z')).toISOString()).toBe('2026-03-15T10:00:00.000Z')
  })
})
