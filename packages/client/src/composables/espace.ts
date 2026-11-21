/**
 * Espace client : la liste de ses sites avec leur état (messages non lus, modifications à publier).
 * Partagée par la barre (pastille des messages) et les pages de l'espace.
 */
import { computed, ref } from 'vue'
import { comptesService, type MonSite } from '@/services/comptes.service'
import { editeurService, type EtatEditeur } from '@/services/editeur.service'

export interface SiteEspace extends MonSite { etat: EtatEditeur | null }

const sites = ref<SiteEspace[] | null>(null)
const erreur = ref('')
let enCours: Promise<void> | null = null

async function charger() {
  erreur.value = ''
  try {
    const liste = await comptesService.mesSites()
    sites.value = await Promise.all(liste.map(async (s) => ({ ...s, etat: await editeurService.etat(s.id).catch(() => null) })))
  } catch {
    erreur.value = 'Impossible de charger vos sites. Réessayez dans un instant.'
  }
}

export function useEspace() {
  const recharger = () => (enCours ??= charger().finally(() => { enCours = null }))
  const responsables = computed(() => (sites.value ?? []).filter((s) => s.role === 'responsable'))
  const nonLus = computed(() => responsables.value.reduce((n, s) => n + (s.etat?.messagesNonLus ?? 0), 0))
  return { sites, erreur, responsables, nonLus, recharger }
}

/** À la déconnexion : rien ne doit rester pour le compte suivant. */
export const oublierEspace = () => { sites.value = null }
