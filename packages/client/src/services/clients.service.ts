/** Espace dev : fiches clients (contact, contrat, notes). */
import { api } from './api'

export type StatutClient = 'essai' | 'actif' | 'suspendu' | 'termine'
export type Periode = 'mois' | 'an' | 'unique'

export interface Client {
  id: string
  nom: string
  contactNom: string | null
  email: string | null
  telephone: string | null
  adresse: string | null
  notes: string
  statut: StatutClient
  formule: string | null
  /** En centimes */
  prix: number | null
  periode: Periode | null
  debut: string | null
  echeance: string | null
  createdAt: string
  sites: { id: string; name: string; slug: string | null; url: string; enPause: boolean }[]
}

/** Ce que le formulaire envoie : prix en euros, dates au format AAAA-MM-JJ. */
export interface FormClient {
  nom: string
  contactNom: string
  email: string
  telephone: string
  adresse: string
  notes: string
  statut: StatutClient
  formule: string
  prix: number | null
  periode: Periode | ''
  debut: string
  echeance: string
}

export const STATUTS: Record<StatutClient, string> = { essai: 'Essai', actif: 'Actif', suspendu: 'Suspendu', termine: 'Terminé' }
export const PERIODES: Record<Periode, string> = { mois: 'par mois', an: 'par an', unique: 'une fois' }

const jour = (d: string | null) => (d ? d.slice(0, 10) : '')

export const versFormulaire = (c?: Client | null): FormClient => ({
  nom: c?.nom ?? '',
  contactNom: c?.contactNom ?? '',
  email: c?.email ?? '',
  telephone: c?.telephone ?? '',
  adresse: c?.adresse ?? '',
  notes: c?.notes ?? '',
  statut: c?.statut ?? 'actif',
  formule: c?.formule ?? '',
  prix: c?.prix == null ? null : c.prix / 100,
  periode: c?.periode ?? '',
  debut: jour(c?.debut ?? null),
  echeance: jour(c?.echeance ?? null),
})

const corps = (f: FormClient) => ({ ...f, prix: f.prix === null || (f.prix as unknown) === '' ? null : Number(f.prix), periode: f.periode || null })

/** Prix lisible : « 25 € par mois ». */
export function prixLisible(c: Pick<Client, 'prix' | 'periode'>) {
  if (c.prix == null) return ''
  const euros = (c.prix / 100).toLocaleString('fr-FR', { minimumFractionDigits: c.prix % 100 ? 2 : 0, maximumFractionDigits: 2 })
  return `${euros} €${c.periode ? ` ${PERIODES[c.periode]}` : ''}`
}

/** Jours avant l'échéance (négatif si elle est passée), ou null. */
export function joursAvantEcheance(c: Pick<Client, 'echeance'>) {
  if (!c.echeance) return null
  const fin = new Date(c.echeance)
  const auj = new Date()
  auj.setHours(0, 0, 0, 0)
  fin.setHours(0, 0, 0, 0)
  return Math.round((fin.getTime() - auj.getTime()) / 86400000)
}

const donnees = <T>(p: Promise<any>) => p.then((r) => r.data as T)

export const clientsService = {
  lister: () => donnees<Client[]>(api.get('/admin/clients')),
  fiche: (id: string) => donnees<Client>(api.get(`/admin/clients/${id}`)),
  creer: (f: FormClient) => donnees<Client>(api.post('/admin/clients', corps(f))),
  modifier: (id: string, f: FormClient) => donnees<Client>(api.put(`/admin/clients/${id}`, corps(f))),
  supprimer: (id: string) => api.delete(`/admin/clients/${id}`),
}
