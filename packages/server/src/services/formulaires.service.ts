/**
 * Messages envoyés par les visiteurs depuis les formulaires des sites.
 * Le formulaire est relu dans la version publiée : seuls ses champs sont gardés.
 */
import fs from 'fs/promises'
import path from 'path'
import { prisma } from '../config/database'
import { logger } from '../utils/logger'
import { Errors } from '../utils/errors'
import * as fichiers from './site-fichiers.service'
import { lireFormulaires, lireEnvoi, type Formulaire } from './formulaires.html'
import { envoyer } from './mail.service'
import { journaliser } from './suivi.service'

/** Formulaires publiés de chaque site, relus au plus toutes les 30 secondes. */
const cache = new Map<string, { date: number; formulaires: Map<string, Formulaire & { page: string }> }>()

async function formulairesPublies(siteId: string) {
  const c = cache.get(siteId)
  if (c && Date.now() - c.date < 30_000) return c.formulaires
  const res = new Map<string, Formulaire & { page: string }>()
  const racine = fichiers.dossiers(siteId).publie
  for (const page of await fichiers.listerPagesPubliees(siteId)) {
    const html = await fs.readFile(path.join(racine, page), 'utf-8').catch(() => '')
    for (const f of lireFormulaires(html)) if (!res.has(f.nom)) res.set(f.nom, { ...f, page })
  }
  cache.set(siteId, { date: Date.now(), formulaires: res })
  return res
}

export interface Resultat { merci: string | null; page: string }

/** Reçoit un envoi : vérifie, enregistre, prévient les responsables du site par e-mail. */
export async function recevoir(siteId: string, nom: string, corps: Record<string, unknown>): Promise<Resultat> {
  const site = await prisma.site.findUnique({ where: { id: siteId }, select: { id: true, name: true, emailMessages: true } })
  if (!site) throw Errors.notFound('Site')
  const f = (await formulairesPublies(site.id)).get(nom)
  if (!f) throw Errors.notFound('Formulaire')
  const envoi = lireEnvoi(f, corps)
  const resultat = { merci: f.merci, page: f.page }
  // Un robot a rempli le champ piège : on fait comme si tout allait bien, sans rien garder
  if (envoi.robot) return resultat
  if (envoi.manquants.length) throw Errors.badRequest(`À compléter : ${envoi.manquants.join(', ')}`)
  if (!envoi.champs.some((c) => c.valeur)) throw Errors.badRequest('Le message est vide')

  await prisma.message.create({ data: { siteId: site.id, formulaire: nom, champs: envoi.champs, email: envoi.email } })
  journaliser(site.id, null, 'message', nom)
  void prevenir(site, nom, envoi.champs, envoi.email)
  return resultat
}

/** Adresses qui reçoivent les messages : celles réglées dans la fiche du site, sinon les responsables. */
async function destinataires(site: { id: string; emailMessages: string | null }) {
  const reglees = (site.emailMessages || '').split(',').map((a) => a.trim()).filter(Boolean)
  if (reglees.length) return reglees
  const membres = await prisma.membre.findMany({ where: { siteId: site.id, role: 'responsable' }, select: { user: { select: { email: true } } } })
  return membres.map((m) => m.user.email)
}

async function prevenir(site: { id: string; name: string; emailMessages: string | null }, nom: string, champs: { libelle: string; valeur: string }[], email: string | null) {
  try {
    const texte = [
      `Nouveau message reçu par le formulaire « ${nom} » du site ${site.name} :`,
      '',
      ...champs.filter((c) => c.valeur).map((c) => `${c.libelle} :\n${c.valeur}\n`),
      email ? 'Répondez simplement à cet e-mail pour écrire à la personne.' : '',
      'Tous les messages sont aussi dans l’éditeur Bifrost, bouton 📨.',
    ].join('\n')
    for (const a of await destinataires(site)) await envoyer(a, `Nouveau message : ${site.name}`, texte, { repondreA: email || undefined })
  } catch (e) {
    logger.warn({ err: e }, 'formulaire : e-mail de notification non envoyé')
  }
}

export const lister = (siteId: string) =>
  prisma.message.findMany({ where: { siteId }, orderBy: { createdAt: 'desc' }, take: 200 })

export const nonLus = (siteId: string) => prisma.message.count({ where: { siteId, lu: false } })

export async function marquerLu(siteId: string, id: string, lu: boolean) {
  const r = await prisma.message.updateMany({ where: { id, siteId }, data: { lu } })
  if (!r.count) throw Errors.notFound('Message')
}

export async function supprimer(siteId: string, id: string) {
  const r = await prisma.message.deleteMany({ where: { id, siteId } })
  if (!r.count) throw Errors.notFound('Message')
}
