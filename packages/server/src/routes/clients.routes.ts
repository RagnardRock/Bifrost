/**
 * Espace dev : fiches clients (contact, contrat, notes) et leurs sites.
 */
import { Router, type Request, type Response, type NextFunction } from 'express'
import { z } from 'zod'
import { authMiddleware, adminMiddleware } from '../middleware/auth.middleware'
import { success } from '../utils/response'
import * as clients from '../services/clients.service'
import * as comptes from '../services/comptes.service'
import * as acces from '../services/acces-client.service'

const router = Router()
router.use(authMiddleware, adminMiddleware)

const action = (fn: (req: Request) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction) => fn(req).then((d) => res.json(success(d))).catch(next)
const id = (req: Request) => z.string().uuid().parse((req.params as Record<string, string>).id)

const texte = (max: number) => z.string().trim().max(max).nullish().transform((v) => v || null)
const date = z.string().trim().nullish().transform((v, ctx) => {
  if (!v) return null
  const d = new Date(v)
  if (Number.isNaN(d.getTime())) { ctx.addIssue({ code: 'custom', message: 'Date invalide' }); return z.NEVER }
  return d
})

const schema = z.object({
  nom: z.string().trim().min(1, 'Le nom est obligatoire').max(120),
  contactNom: texte(120),
  email: z.string().trim().max(200).nullish().transform((v) => v || null).refine((v) => !v || z.string().email().safeParse(v).success, 'Adresse e-mail invalide'),
  telephone: texte(40),
  adresse: texte(300),
  notes: z.string().max(5000).default(''),
  statut: z.enum(clients.STATUTS).default('actif'),
  formule: texte(120),
  // En euros dans le formulaire, en centimes en base
  prix: z.number().min(0).max(1_000_000).nullish().transform((v) => (v == null ? null : Math.round(v * 100))),
  periode: z.enum(clients.PERIODES).nullish().transform((v) => v || null),
  debut: date,
  echeance: date,
})

router.get('/', action(async () => clients.lister()))
router.post('/', action(async (req) => clients.creer(schema.parse(req.body))))
router.get('/:id', action(async (req) => clients.fiche(id(req))))
router.put('/:id', action(async (req) => clients.modifier(id(req), schema.parse(req.body))))
router.delete('/:id', action(async (req) => { await clients.supprimer(id(req)); return { id: id(req) } }))

// Accès : des personnes invitées sur tous les sites du client (et ceux rattachés plus tard)
const role = z.enum(['responsable', 'redacteur'])
const personne = (req: Request) => z.string().uuid().parse((req.params as Record<string, string>).personne)
router.get('/:id/acces', action(async (req) => { await clients.fiche(id(req)); return acces.lister(id(req)) }))
router.post('/:id/acces', action(async (req) => {
  const b = z.object({ email: z.string().trim().email('Adresse e-mail invalide'), role }).parse(req.body)
  return comptes.inviterClient(id(req), b.email, b.role, 'Votre développeur')
}))
router.put('/:id/acces/:personne', action(async (req) => {
  await acces.changerRole(id(req), personne(req), z.object({ role }).parse(req.body).role)
  return acces.lister(id(req))
}))
router.delete('/:id/acces/:personne', action(async (req) => { await acces.retirer(id(req), personne(req)); return acces.lister(id(req)) }))
router.delete('/:id/invitations/:personne', action(async (req) => { await comptes.annulerInvitationClient(id(req), personne(req)); return acces.lister(id(req)) }))

export default router
