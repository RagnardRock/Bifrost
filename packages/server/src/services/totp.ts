/**
 * Codes à 6 chiffres des applis d'authentification (TOTP, RFC 6238), sans dépendance.
 * Fonctions pures, testées à part.
 */
import crypto from 'crypto'

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
export const PERIODE = 30

export function base32(buf: Buffer) {
  let bits = 0, valeur = 0, res = ''
  for (const octet of buf) {
    valeur = (valeur << 8) | octet
    bits += 8
    while (bits >= 5) { res += ALPHABET[(valeur >>> (bits - 5)) & 31]; bits -= 5 }
  }
  if (bits > 0) res += ALPHABET[(valeur << (5 - bits)) & 31]
  return res
}

export function deBase32(texte: string) {
  const t = texte.replace(/[\s=-]/g, '').toUpperCase()
  let bits = 0, valeur = 0
  const res: number[] = []
  for (const c of t) {
    const i = ALPHABET.indexOf(c)
    if (i < 0) throw new Error('Secret illisible')
    valeur = (valeur << 5) | i
    bits += 5
    if (bits >= 8) { res.push((valeur >>> (bits - 8)) & 255); bits -= 8 }
  }
  return Buffer.from(res)
}

export const nouveauSecret = () => base32(crypto.randomBytes(20))

/** Code à 6 chiffres pour un pas de temps donné (HOTP). */
export function code(secret: string, pas: number) {
  const compteur = Buffer.alloc(8)
  compteur.writeBigUInt64BE(BigInt(pas))
  const h = crypto.createHmac('sha1', deBase32(secret)).update(compteur).digest()
  const o = h[h.length - 1]! & 15
  const n = ((h[o]! & 127) << 24) | (h[o + 1]! << 16) | (h[o + 2]! << 8) | h[o + 3]!
  return String(n % 1_000_000).padStart(6, '0')
}

export const pasActuel = (maintenant = Date.now()) => Math.floor(maintenant / 1000 / PERIODE)

/**
 * Vérifie un code, en tolérant un pas d'écart (horloge du téléphone un peu décalée).
 * Renvoie le pas reconnu, ou null. Un pas déjà utilisé (`dernier`) est refusé : un code ne sert qu'une fois.
 */
export function verifier(secret: string, saisi: string, dernier: number | null, maintenant = Date.now()) {
  const c = saisi.replace(/\s/g, '')
  if (!/^\d{6}$/.test(c)) return null
  const p = pasActuel(maintenant)
  for (const pas of [p, p - 1, p + 1]) {
    if (dernier !== null && pas <= dernier) continue
    if (crypto.timingSafeEqual(Buffer.from(code(secret, pas)), Buffer.from(c))) return pas
  }
  return null
}

/** Adresse lue par l'appli (QR code). */
export const adresseOtp = (secret: string, compte: string, emetteur = 'Bifrost') =>
  `otpauth://totp/${encodeURIComponent(emetteur)}:${encodeURIComponent(compte)}?secret=${secret}&issuer=${encodeURIComponent(emetteur)}&algorithm=SHA1&digits=6&period=${PERIODE}`

// ---------- secret chiffré en base ----------

const cle = (graine: string) => crypto.createHash('sha256').update(`bifrost-2fa:${graine}`).digest()

export function chiffrer(secret: string, graine: string) {
  const iv = crypto.randomBytes(12)
  const c = crypto.createCipheriv('aes-256-gcm', cle(graine), iv)
  const donnees = Buffer.concat([c.update(secret, 'utf8'), c.final()])
  return ['v1', iv.toString('base64url'), c.getAuthTag().toString('base64url'), donnees.toString('base64url')].join('.')
}

export function dechiffrer(texte: string, graine: string) {
  const [v, iv, tag, donnees] = texte.split('.')
  if (v !== 'v1' || !iv || !tag || !donnees) throw new Error('Secret illisible')
  const d = crypto.createDecipheriv('aes-256-gcm', cle(graine), Buffer.from(iv, 'base64url'))
  d.setAuthTag(Buffer.from(tag, 'base64url'))
  return Buffer.concat([d.update(Buffer.from(donnees, 'base64url')), d.final()]).toString('utf8')
}

// ---------- codes de secours ----------

/** 10 codes de secours lisibles (« k7mq-2xpa »), à usage unique. */
export function codesDeSecours(n = 10) {
  const lettres = 'abcdefghjkmnpqrstuvwxyz23456789'
  return Array.from({ length: n }, () => {
    const o = crypto.randomBytes(8)
    const s = [...o].map((x) => lettres[x % lettres.length]).join('')
    return `${s.slice(0, 4)}-${s.slice(4)}`
  })
}
export const empreinteSecours = (c: string) => crypto.createHash('sha256').update(c.trim().toLowerCase().replace(/[\s-]/g, '')).digest('hex')
