import { describe, it, expect } from 'vitest'
import * as t from './totp'

// Secret de la RFC 6238 (« 12345678901234567890 ») en base32
const RFC = t.base32(Buffer.from('12345678901234567890'))

describe('codes TOTP', () => {
  it('donne les codes de la RFC 6238 (6 derniers chiffres)', () => {
    expect(t.code(RFC, Math.floor(59 / 30))).toBe('287082')
    expect(t.code(RFC, Math.floor(1111111109 / 30))).toBe('081804')
    expect(t.code(RFC, Math.floor(1234567890 / 30))).toBe('005924')
    expect(t.code(RFC, Math.floor(2000000000 / 30))).toBe('279037')
  })

  it('base32 aller-retour', () => {
    const s = t.nouveauSecret()
    expect(s).toMatch(/^[A-Z2-7]{32}$/)
    expect(t.base32(t.deBase32(s))).toBe(s)
  })

  it('accepte un pas d’écart, refuse un code réutilisé ou mal formé', () => {
    const maintenant = 1_800_000_000_000
    const pas = t.pasActuel(maintenant)
    expect(t.verifier(RFC, t.code(RFC, pas), null, maintenant)).toBe(pas)
    expect(t.verifier(RFC, t.code(RFC, pas - 1), null, maintenant)).toBe(pas - 1)
    expect(t.verifier(RFC, t.code(RFC, pas - 2), null, maintenant)).toBeNull()
    expect(t.verifier(RFC, t.code(RFC, pas), pas, maintenant)).toBeNull()
    expect(t.verifier(RFC, '12345', null, maintenant)).toBeNull()
    const c = t.code(RFC, pas)
    expect(t.verifier(RFC, `${c.slice(0, 3)} ${c.slice(3)}`, null, maintenant)).toBe(pas)
  })

  it('chiffre le secret, et refuse une autre clé', () => {
    const c = t.chiffrer('ABCDEF', 'graine')
    expect(c).not.toContain('ABCDEF')
    expect(t.dechiffrer(c, 'graine')).toBe('ABCDEF')
    expect(() => t.dechiffrer(c, 'autre')).toThrow()
  })

  it('codes de secours lisibles et empreinte tolérante', () => {
    const codes = t.codesDeSecours()
    expect(codes).toHaveLength(10)
    expect(new Set(codes).size).toBe(10)
    for (const c of codes) expect(c).toMatch(/^[a-z2-9]{4}-[a-z2-9]{4}$/)
    expect(t.empreinteSecours(codes[0]!.toUpperCase().replace('-', ' '))).toBe(t.empreinteSecours(codes[0]!))
  })
})
