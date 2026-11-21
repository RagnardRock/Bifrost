import { api } from './api'

export interface MonSite { id: string; nom: string; slug: string | null; role: 'responsable' | 'redacteur' }
export interface Session { token: string; user: { id: string; email: string; siteId: string; role: string; site: { id: string; name: string; slug: string | null } } }
export interface ReglagesNotifications { messages: boolean; aPublier: boolean; appareils: number; cle: string }
export interface EtatDoubleAuth { actif: boolean; codesRestants: number }
/** Mêmes actions pour un compte client et pour le compte dev. */
export interface ApiDoubleAuth {
  etat: () => Promise<EtatDoubleAuth>
  preparer: () => Promise<{ secret: string; adresse: string }>
  activer: (code: string) => Promise<{ codes: string[] }>
  desactiver: (motDePasse: string, code: string) => Promise<unknown>
  codes: (code: string) => Promise<{ codes: string[] }>
}
/** La connexion demande le code de l'appli d'authentification. */
export const codeDemande = (e: any) => e?.response?.data?.error?.code === 'CODE_REQUIS'

const donnees = <T>(p: Promise<any>) => p.then((r) => r.data as T)

export const comptesService = {
  mesSites: () => donnees<MonSite[]>(api.get('/comptes/mes-sites')),
  changerSite: (site: string) => donnees<Session>(api.post('/comptes/changer-site', { site })),
  connexion: (email: string, motDePasse: string, siteId?: string, code?: string) =>
    donnees<Session>(api.post('/comptes/connexion', { email, motDePasse, siteId, code: code || undefined })),
  oubli: (email: string) => api.post('/comptes/oubli', { email }),
  lireAcces: (jeton: string) => donnees<{ type: 'invitation' | 'reinitialisation'; email: string; site: { nom: string } }>(api.get(`/comptes/acces/${jeton}`)),
  changerMotDePasse: (actuel: string, nouveau: string) => api.post('/comptes/mot-de-passe', { actuel, nouveau }),
  /** Session ouverte, ou { connexion: true } si le compte a la double authentification (il faut alors se connecter avec le code). */
  utiliserAcces: (jeton: string, motDePasse: string) => donnees<Session | { connexion: true; email: string }>(api.post(`/comptes/acces/${jeton}`, { motDePasse })),
  notifications: {
    lire: () => donnees<ReglagesNotifications>(api.get('/comptes/notifications')),
    regler: (r: { messages?: boolean; aPublier?: boolean }) => donnees<ReglagesNotifications>(api.put('/comptes/notifications', r)),
    ajouterAppareil: (abonnement: PushSubscriptionJSON) => donnees<ReglagesNotifications>(api.post('/comptes/notifications/appareils', abonnement)),
    retirerAppareil: (endpoint: string) => donnees<ReglagesNotifications>(api.post('/comptes/notifications/appareils/retirer', { endpoint })),
  },
  doubleAuth: {
    etat: () => donnees<EtatDoubleAuth>(api.get('/comptes/double-auth')),
    preparer: () => donnees<{ secret: string; adresse: string }>(api.post('/comptes/double-auth/preparer')),
    activer: (code: string) => donnees<{ codes: string[] }>(api.post('/comptes/double-auth/activer', { code })),
    desactiver: (motDePasse: string, code: string) => api.post('/comptes/double-auth/desactiver', { motDePasse, code }),
    codes: (code: string) => donnees<{ codes: string[] }>(api.post('/comptes/double-auth/codes', { code })),
  } satisfies ApiDoubleAuth,
}
