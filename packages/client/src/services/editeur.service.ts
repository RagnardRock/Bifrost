import { api } from './api'

export interface Differences { ajoutes: string[]; modifies: string[]; supprimes: string[] }
export interface Publication extends Differences { id: string; createdAt: string; annulee: boolean; auteur: string | null }
export type RoleSite = 'responsable' | 'redacteur'
export interface EtatEditeur {
  site: { id: string; name: string; url: string; slug: string | null }
  pages: string[]
  differences: Differences
  moi: { role: RoleSite; dev: boolean; id: string | null }
}
export interface Membre { id: string; email: string; role: RoleSite; createdAt: string }
export interface Invitation { id: string; email: string; role: RoleSite; expireLe: string }

const base = (siteId: string) => `/editeur/${siteId}`
const donnees = <T>(p: Promise<any>) => p.then((r) => r.data as T)

export const editeurService = {
  etat: (siteId: string) => donnees<EtatEditeur>(api.get(base(siteId))),
  ouvrirSession: (siteId: string) => api.post(`${base(siteId)}/session`),
  modifierChamp: (siteId: string, cle: string, valeur: string) => api.put(`${base(siteId)}/champ`, { cle, valeur }),
  operationListe: (siteId: string, corps: Record<string, unknown>) => api.post(`${base(siteId)}/liste`, corps),
  envoyerImage: (siteId: string, fichier: File) => {
    const f = new FormData()
    f.append('image', fichier)
    return donnees<{ chemin: string }>(api.post(`${base(siteId)}/image`, f, { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 120000 }))
  },
  nouvelElement: (siteId: string, nom: string, corps: { titre: string; date?: string; texte?: string; photos: string[] }) =>
    donnees<{ page: string }>(api.post(`${base(siteId)}/collection/${encodeURIComponent(nom)}`, corps)),
  publier: (siteId: string) => donnees<{ publication: Publication | null }>(api.post(`${base(siteId)}/publier`)),
  abandonner: (siteId: string) => api.post(`${base(siteId)}/abandonner`),
  publications: (siteId: string) => donnees<Publication[]>(api.get(`${base(siteId)}/publications`)),
  annuler: (siteId: string, id: string) => api.post(`${base(siteId)}/publications/${id}/annuler`),
  equipe: (siteId: string) => donnees<{ membres: Membre[]; invitations: Invitation[] }>(api.get(`${base(siteId)}/equipe`)),
  inviter: (siteId: string, email: string, role: RoleSite) =>
    donnees<{ lien: string; envoye: boolean }>(api.post(`${base(siteId)}/equipe/invitations`, { email, role })),
  annulerInvitation: (siteId: string, id: string) => api.delete(`${base(siteId)}/equipe/invitations/${id}`),
  changerRole: (siteId: string, id: string, role: RoleSite) => api.put(`${base(siteId)}/equipe/membres/${id}`, { role }),
  retirer: (siteId: string, id: string) => api.delete(`${base(siteId)}/equipe/membres/${id}`),
}
