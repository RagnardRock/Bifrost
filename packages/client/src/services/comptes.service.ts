import { api } from './api'

export interface MonSite { id: string; nom: string; slug: string | null; role: 'responsable' | 'redacteur' }
export interface Session { token: string; user: { id: string; email: string; siteId: string; role: string; site: { id: string; name: string; slug: string | null } } }
export interface ChoixSites { sites: { id: string; nom: string }[] }

const donnees = <T>(p: Promise<any>) => p.then((r) => r.data as T)

export const comptesService = {
  mesSites: () => donnees<MonSite[]>(api.get('/comptes/mes-sites')),
  changerSite: (site: string) => donnees<Session>(api.post('/comptes/changer-site', { site })),
  connexion: (email: string, motDePasse: string, siteId?: string) =>
    donnees<Session | ChoixSites>(api.post('/comptes/connexion', { email, motDePasse, siteId })),
  oubli: (email: string) => api.post('/comptes/oubli', { email }),
  lireAcces: (jeton: string) => donnees<{ type: 'invitation' | 'reinitialisation'; email: string; site: { nom: string } }>(api.get(`/comptes/acces/${jeton}`)),
  changerMotDePasse: (actuel: string, nouveau: string) => api.post('/comptes/mot-de-passe', { actuel, nouveau }),
  utiliserAcces: (jeton: string, motDePasse: string) => donnees<Session>(api.post(`/comptes/acces/${jeton}`, { motDePasse })),
}
