import { describe, it, expect, vi, beforeEach } from 'vitest'

const envois: { endpoint: string; charge: string }[] = []
let reponse: (endpoint: string) => void = () => {}
vi.mock('web-push', () => ({
  default: {
    generateVAPIDKeys: () => ({ publicKey: 'cle-publique', privateKey: 'cle-privee' }),
    sendNotification: vi.fn(async (s: { endpoint: string }, charge: string) => { reponse(s.endpoint); envois.push({ endpoint: s.endpoint, charge }) }),
  },
}))

const abonnements = [
  { id: 'a1', userId: 'resp', endpoint: 'https://push.test/resp', p256dh: 'p', auth: 'a' },
  { id: 'a2', userId: 'autre', endpoint: 'https://push.test/autre', p256dh: 'p', auth: 'a' },
  { id: 'a3', userId: 'vieux', endpoint: 'https://push.test/vieux', p256dh: 'p', auth: 'a' },
]
const supprimes: string[] = []
const membres = vi.fn(async (_q: unknown) => [{ userId: 'resp' }, { userId: 'redac-auteur' }])
vi.mock('../config/database', () => ({
  prisma: {
    abonnementPush: {
      findMany: vi.fn(async ({ where }: { where: { userId: { in: string[] } } }) => abonnements.filter((a) => where.userId.in.includes(a.userId))),
      delete: vi.fn(async ({ where }: { where: { id: string } }) => { supprimes.push(where.id) }),
    },
    membre: { findMany: (q: unknown) => membres(q) },
    site: { findUnique: vi.fn(async () => ({ name: 'Vroom', slug: 'vroom' })) },
  },
}))

process.env.VAPID_PUBLIQUE = 'cle-publique'
process.env.VAPID_PRIVEE = 'cle-privee'
const n = await import('./notifications.service')

beforeEach(() => { envois.length = 0; supprimes.length = 0; reponse = () => {}; n._oublierDelais(); membres.mockClear() })

describe('notifications', () => {
  it('nouveau message : prévient les responsables qui le veulent, avec le lien vers les messages', async () => {
    await n.nouveauMessage('s1', 'contact', 'Bonjour, je voudrais un devis')
    expect(envois.map((e) => e.endpoint)).toEqual(['https://push.test/resp'])
    const charge = JSON.parse(envois[0]!.charge)
    expect(charge).toMatchObject({ titre: 'Nouveau message · Vroom', url: '/mon-site/vroom?onglet=messages' })
    expect(membres.mock.calls[0]![0]).toMatchObject({ where: { siteId: 's1', role: 'responsable', user: { notifMessages: true } } })
  })

  it('modifications à publier : pas à l’auteur, et une seule fois par heure et par site', async () => {
    await n.modificationsAPublier('s1', 'resp')
    expect(envois).toHaveLength(0) // le seul abonné était l'auteur
    n._oublierDelais()
    await n.modificationsAPublier('s1', 'redac-auteur')
    await n.modificationsAPublier('s1', 'redac-auteur')
    expect(envois).toHaveLength(1)
    expect(JSON.parse(envois[0]!.charge).url).toBe('/edition/vroom')
    await n.modificationsAPublier('s2', 'redac-auteur')
    expect(envois).toHaveLength(2)
  })

  it('un appareil qui n’existe plus (410) est retiré', async () => {
    reponse = (e) => { if (e.endsWith('vieux')) throw Object.assign(new Error('parti'), { statusCode: 410 }) }
    expect(await n.envoyerA(['resp', 'vieux'], { titre: 't', texte: 'x', url: '/' })).toBe(1)
    expect(supprimes).toEqual(['a3'])
  })
})
