import { api } from './api'
import type { Differences, Publication } from './editeur.service'

export interface SiteSuivi {
  id: string
  nom: string
  url: string
  slug: string | null
  enPause: boolean
  client: ClientResume | null
  pages: number | null
  enAttente: number | null
  membres: number
  invitations: number
  dernierePublication: { date: string; auteur: string | null } | null
  derniereActivite: { date: string; type: string; auteur: string | null } | null
}
export interface ClientResume { id: string; nom: string; statut: string }
export interface SiteSupprime { id: string; nom: string; supprimeLe: string; effaceLe: string; messages: number }
export interface Evenement { id: string; date: string; type: string; detail: string; site: { id: string; nom: string }; auteur: string | null }
export interface FicheSite {
  site: { id: string; name: string; url: string; slug: string | null; emailMessages: string | null; createdAt: string; enPause: boolean; client: ClientResume | null }
  pages: number
  differences: Differences | null
  publications: Publication[]
}

/** Adresse publique d'un site hébergé par Bifrost. */
export const adresseSite = (s: { id: string; slug?: string | null }) => `/sites/${s.slug || s.id}/`

const donnees = <T>(p: Promise<any>) => p.then((r) => r.data as T)
const envoiOptions = (progres?: (p: number) => void) => ({
  headers: { 'Content-Type': 'multipart/form-data' },
  timeout: 600000,
  onUploadProgress: (e: { loaded: number; total?: number }) => progres?.(e.total ? Math.round((e.loaded / e.total) * 100) : 0),
})

export const suiviService = {
  sites: () => donnees<SiteSuivi[]>(api.get('/admin/suivi/sites')),
  creer: (nom: string, url: string, dossier: string) =>
    donnees<{ id: string; pages: number }>(api.post('/admin/suivi/sites', { nom, url, dossier }, { timeout: 120000 })),
  /** Envoi depuis le navigateur (ZIP). `progres` reçoit un pourcentage. */
  creerEnvoi: (nom: string, url: string, archive: Blob, progres?: (p: number) => void) => {
    const f = new FormData()
    f.append('nom', nom)
    f.append('url', url)
    f.append('archive', archive, 'site.zip')
    return donnees<{ id: string; pages: number }>(api.post('/admin/suivi/sites/envoi', f, envoiOptions(progres)))
  },
  reimporterEnvoi: (id: string, archive: Blob, progres?: (p: number) => void) => {
    const f = new FormData()
    f.append('archive', archive, 'site.zip')
    return api.post(`/admin/suivi/sites/${id}/envoi`, f, envoiOptions(progres))
  },
  modifier: (id: string, nom: string, url: string, slug?: string, emailMessages?: string) => api.put(`/admin/suivi/sites/${id}`, { nom, url, slug: slug || undefined, emailMessages }),
  reimporter: (id: string, dossier: string) => api.post(`/admin/suivi/sites/${id}/importer`, { dossier }, { timeout: 120000 }),
  fiche: (id: string) => donnees<FicheSite>(api.get(`/admin/suivi/sites/${id}`)),
  rattacher: (id: string, client: string | null) => api.put(`/admin/suivi/sites/${id}/client`, { client }),
  pause: (id: string, pause: boolean) => api.put(`/admin/suivi/sites/${id}/pause`, { pause }),
  /** Télécharge le site en ZIP (version en ligne ou brouillon). */
  exporter: async (id: string, nom: string, version: 'publie' | 'brouillon' = 'publie') => {
    const zip = (await api.get(`/admin/suivi/sites/${id}/export`, { params: { version }, responseType: 'blob', timeout: 120000 })) as unknown as Blob
    const lien = document.createElement('a')
    lien.href = URL.createObjectURL(zip)
    lien.download = `${nom}${version === 'brouillon' ? '-brouillon' : ''}.zip`
    lien.click()
    setTimeout(() => URL.revokeObjectURL(lien.href), 10000)
  },
  supprimer: (id: string, nom: string) => api.delete(`/admin/suivi/sites/${id}`, { data: { nom } }),
  corbeille: () => donnees<SiteSupprime[]>(api.get('/admin/suivi/corbeille')),
  restaurer: (id: string) => donnees<{ id: string; slug: string | null }>(api.post(`/admin/suivi/corbeille/${id}/restaurer`)),
  effacer: (id: string) => api.delete(`/admin/suivi/corbeille/${id}`),
  activite: (site?: string, limite = 100) => donnees<Evenement[]>(api.get('/admin/suivi/activite', { params: { site, limite } })),
}

/** Libellés du journal. */
export const TYPES: Record<string, { icone: string; texte: string }> = {
  modification: { icone: '✏️', texte: 'a modifié' },
  image: { icone: '🖼️', texte: 'a changé une photo' },
  liste: { icone: '↕️', texte: 'a réorganisé' },
  actualite: { icone: '📰', texte: 'a ajouté l’actualité' },
  publication: { icone: '🚀', texte: 'a publié' },
  annulation: { icone: '↩️', texte: 'a annulé la' },
  abandon: { icone: '🗑️', texte: 'a effacé les modifications non publiées' },
  import: { icone: '📦', texte: 'a importé le site' },
  invitation: { icone: '✉️', texte: 'a invité' },
  arrivee: { icone: '👋', texte: 'a rejoint l’équipe' },
  'mot-de-passe': { icone: '🔑', texte: 'a changé son mot de passe' },
  role: { icone: '🎚️', texte: 'a changé le rôle de' },
  retrait: { icone: '🚪', texte: 'a retiré de l’équipe' },
  message: { icone: '📨', texte: 'a envoyé un message par le formulaire' },
  pause: { icone: '⏸️', texte: 'a mis le site en pause' },
  reprise: { icone: '▶️', texte: 'a remis le site en ligne' },
  restauration: { icone: '♻️', texte: 'a restauré le site supprimé' },
}

export function ilYa(d: string) {
  const s = Math.round((Date.now() - new Date(d).getTime()) / 1000)
  if (s < 60) return 'à l’instant'
  if (s < 3600) return `il y a ${Math.round(s / 60)} min`
  if (s < 86400) return `il y a ${Math.round(s / 3600)} h`
  if (s < 7 * 86400) return `il y a ${Math.round(s / 86400)} j`
  return new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
}
