import { api } from './api'
import type { Differences, Publication } from './editeur.service'

export interface SiteSuivi {
  id: string
  nom: string
  url: string
  pages: number | null
  enAttente: number | null
  membres: number
  invitations: number
  dernierePublication: { date: string; auteur: string | null } | null
  derniereActivite: { date: string; type: string; auteur: string | null } | null
}
export interface Evenement { id: string; date: string; type: string; detail: string; site: { id: string; nom: string }; auteur: string | null }
export interface FicheSite {
  site: { id: string; name: string; url: string; createdAt: string }
  pages: number
  differences: Differences | null
  publications: Publication[]
}

const donnees = <T>(p: Promise<any>) => p.then((r) => r.data as T)

export const suiviService = {
  sites: () => donnees<SiteSuivi[]>(api.get('/admin/suivi/sites')),
  creer: (nom: string, url: string, dossier: string) =>
    donnees<{ id: string; pages: number }>(api.post('/admin/suivi/sites', { nom, url, dossier }, { timeout: 120000 })),
  modifier: (id: string, nom: string, url: string) => api.put(`/admin/suivi/sites/${id}`, { nom, url }),
  reimporter: (id: string, dossier: string) => api.post(`/admin/suivi/sites/${id}/importer`, { dossier }, { timeout: 120000 }),
  fiche: (id: string) => donnees<FicheSite>(api.get(`/admin/suivi/sites/${id}`)),
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
}

export function ilYa(d: string) {
  const s = Math.round((Date.now() - new Date(d).getTime()) / 1000)
  if (s < 60) return 'à l’instant'
  if (s < 3600) return `il y a ${Math.round(s / 60)} min`
  if (s < 86400) return `il y a ${Math.round(s / 3600)} h`
  if (s < 7 * 86400) return `il y a ${Math.round(s / 86400)} j`
  return new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
}
