/**
 * Installation de l'appli (PWA) : invite d'Android/Chrome, consignes pour iPhone, appli déjà installée.
 * `ecouterInstallation()` est appelé tôt (main.ts) : l'invite arrive parfois avant que la page soit affichée.
 */
import { computed, ref } from 'vue'

interface InviteInstallation extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const invite = ref<InviteInstallation | null>(null)
const installee = ref(false)

const enModeAppli = () =>
  window.matchMedia?.('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true

export function ecouterInstallation() {
  installee.value = enModeAppli()
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    invite.value = e as InviteInstallation
  })
  window.addEventListener('appinstalled', () => {
    installee.value = true
    invite.value = null
  })
}

/** Enregistre le service worker (en ligne seulement : en développement, il gênerait le rechargement à chaud). */
export function enregistrerServiceWorker() {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => { /* pas grave : le site marche sans */ })
  })
}

export function useInstallation() {
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  // Sur iPhone, seul Safari sait ajouter à l'écran d'accueil (les autres navigateurs aussi depuis iOS 16.4, via Partager)
  const possible = computed(() => !installee.value && (!!invite.value || ios))
  async function installer() {
    if (!invite.value) return false
    await invite.value.prompt()
    const { outcome } = await invite.value.userChoice
    invite.value = null
    if (outcome === 'accepted') installee.value = true
    return outcome === 'accepted'
  }
  return { installee, possible, ios, avecInvite: computed(() => !!invite.value), installer }
}
