/**
 * Durées de conservation des données personnelles (RGPD) : ce qui a dépassé sa durée est effacé
 * au démarrage puis chaque jour. Le détail est dans docs/rgpd.md.
 */
import { prisma } from '../config/database'
import { logger } from '../utils/logger'

const mois = (nom: string, defaut: number) => {
  const n = Number(process.env[nom])
  return Number.isFinite(n) && n > 0 ? n : defaut
}

/** Durées, en mois (réglables dans le .env) */
export const durees = () => ({
  /** Messages des formulaires (nom, e-mail, texte des visiteurs) */
  messages: mois('CONSERVATION_MESSAGES_MOIS', 12),
  /** Journal d'activité des sites (qui a modifié ou publié quoi) */
  journal: mois('CONSERVATION_JOURNAL_MOIS', 24),
  /** Envois de webhooks (contenu envoyé à d'autres services) */
  webhooks: 3,
  /** Liens d'invitation et de mot de passe oublié, après leur expiration */
  liens: 1,
})

/** Date avant laquelle on efface : maintenant moins n mois. */
export function limite(n: number, maintenant = new Date()) {
  const d = new Date(maintenant)
  d.setMonth(d.getMonth() - n)
  return d
}

export async function effacerAnciennesDonnees(maintenant = new Date()) {
  const d = durees()
  const [messages, journal, webhooks, liens] = await Promise.all([
    prisma.message.deleteMany({ where: { createdAt: { lt: limite(d.messages, maintenant) } } }),
    prisma.evenement.deleteMany({ where: { createdAt: { lt: limite(d.journal, maintenant) } } }),
    prisma.webhookLog.deleteMany({ where: { createdAt: { lt: limite(d.webhooks, maintenant) } } }),
    prisma.jeton.deleteMany({ where: { expireLe: { lt: limite(d.liens, maintenant) } } }),
  ])
  const total = messages.count + journal.count + webhooks.count + liens.count
  if (total) logger.info({ messages: messages.count, journal: journal.count, webhooks: webhooks.count, liens: liens.count }, 'conservation : anciennes données effacées')
  return { messages: messages.count, journal: journal.count, webhooks: webhooks.count, liens: liens.count }
}
