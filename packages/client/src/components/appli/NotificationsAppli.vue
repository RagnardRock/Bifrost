<script setup lang="ts">
/**
 * Notifications sur cet appareil : activer ou couper, et choisir quoi recevoir
 * (réglage de la personne, le même sur tous ses appareils).
 */
import { onMounted, ref } from 'vue'
import { comptesService, type ReglagesNotifications } from '@/services/comptes.service'
import { useInstallation } from '@/composables/installation'

const { installee, ios } = useInstallation()
const possible = typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
const reglages = ref<ReglagesNotifications | null>(null)
const abonnement = ref<PushSubscription | null>(null)
const occupe = ref(false)
const erreur = ref('')

/** Le service worker n'existe que dans l'appli en ligne : on n'attend pas indéfiniment. */
function enregistrement() {
  return Promise.race([
    navigator.serviceWorker.ready,
    new Promise<never>((_r, non) => setTimeout(() => non(new Error('sw')), 4000)),
  ])
}

const octets = (base64: string) => {
  const b = atob((base64 + '='.repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(b, (c) => c.charCodeAt(0))
}

onMounted(async () => {
  try { reglages.value = await comptesService.notifications.lire() } catch { /* carte masquée */ }
  if (!possible) return
  try { abonnement.value = await (await enregistrement()).pushManager.getSubscription() } catch { /* pas de service worker */ }
})

async function activer() {
  erreur.value = ''
  occupe.value = true
  try {
    if (await Notification.requestPermission() !== 'granted') {
      erreur.value = 'Les notifications sont bloquées pour Bifrost. Autorisez-les dans les réglages du téléphone, puis réessayez.'
      return
    }
    const reg = await enregistrement()
    const cle = reglages.value?.cle || (await comptesService.notifications.lire()).cle
    const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: octets(cle) })
    reglages.value = await comptesService.notifications.ajouterAppareil(sub.toJSON())
    abonnement.value = sub
  } catch (e) {
    erreur.value = (e as Error)?.message === 'sw' ? 'Les notifications marchent dans l’appli en ligne, pas en version d’essai.' : 'Activation impossible. Réessayez dans un instant.'
  } finally {
    occupe.value = false
  }
}

async function couper() {
  if (!abonnement.value) return
  occupe.value = true
  try {
    const endpoint = abonnement.value.endpoint
    await abonnement.value.unsubscribe()
    abonnement.value = null
    reglages.value = await comptesService.notifications.retirerAppareil(endpoint)
  } catch {
    erreur.value = 'Action impossible. Réessayez dans un instant.'
  } finally {
    occupe.value = false
  }
}

async function regler(cle: 'messages' | 'aPublier', valeur: boolean) {
  try { reglages.value = await comptesService.notifications.regler({ [cle]: valeur }) } catch { erreur.value = 'Réglage non enregistré.' }
}
</script>

<template>
  <div v-if="reglages" class="na">
    <template v-if="!possible">
      <p v-if="ios && !installee" class="na-aide">Sur iPhone, installez d’abord l’appli (carte ci-dessus) puis ouvrez-la depuis l’écran d’accueil : les notifications s’activent ici.</p>
      <p v-else class="na-aide">Ce navigateur ne sait pas recevoir de notifications.</p>
    </template>
    <template v-else>
      <div class="na-ligne">
        <span class="na-etat" :class="{ 'na-etat--on': abonnement }">{{ abonnement ? '🔔 Activées sur cet appareil' : '🔕 Coupées sur cet appareil' }}</span>
        <button v-if="!abonnement" type="button" class="na-btn na-btn--fort" :disabled="occupe" @click="activer">Activer</button>
        <button v-else type="button" class="na-btn" :disabled="occupe" @click="couper">Couper</button>
      </div>
      <p v-if="erreur" class="na-erreur" role="alert">{{ erreur }}</p>
    </template>
    <fieldset class="na-choix">
      <legend>Me prévenir quand</legend>
      <label><input type="checkbox" :checked="reglages.messages" @change="regler('messages', ($event.target as HTMLInputElement).checked)"> un message arrive par le formulaire</label>
      <label><input type="checkbox" :checked="reglages.aPublier" @change="regler('aPublier', ($event.target as HTMLInputElement).checked)"> un rédacteur a modifié le site (à publier)</label>
    </fieldset>
    <p v-if="reglages.appareils > 1" class="na-aide">Activées sur {{ reglages.appareils }} appareils.</p>
  </div>
</template>

<style scoped>
.na { display: grid; gap: 12px; }
.na-ligne { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
.na-etat { font-weight: 600; color: var(--bf-doux); }
.na-etat--on { color: var(--bf-texte); }
.na-btn { min-height: 44px; padding: 0 18px; border-radius: 999px; border: 0; background: var(--bf-verre-fort); box-shadow: inset 0 0 0 1px var(--bf-bord); color: var(--bf-texte); font-size: 14px; font: inherit; font-weight: 600; cursor: pointer; }
.na-btn--fort { color: #fff; background: var(--bf-degrade); box-shadow: none; }
.na-btn:disabled { opacity: .6; cursor: default; }
.na-choix { border: 0; margin: 0; padding: 0; display: grid; gap: 8px; }
.na-choix legend { padding: 0; margin-bottom: 6px; font-size: 13px; color: var(--bf-doux); }
.na-choix label { display: flex; gap: 10px; align-items: center; font-weight: 400; }
.na-choix input { width: 18px; height: 18px; accent-color: #8b5cf6; flex: none; }
.na-aide { margin: 0; font-size: 13px; color: var(--bf-doux); }
.na-erreur { margin: 0; font-size: 13px; color: #c2410c; }
</style>
