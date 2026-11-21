/*
 * Service worker de l'appli Bifrost (PWA).
 * - L'interface (fichiers /assets/ dont le nom change à chaque version) est gardée sur l'appareil : ouverture rapide.
 * - Les pages de l'appli passent toujours par le réseau ; sans réseau, la page « Pas de connexion ».
 * - L'API, l'aperçu de l'éditeur et les sites publiés ne sont jamais interceptés.
 */
const VERSION = 'bifrost-v1'
const ESSENTIEL = ['/hors-ligne.html', '/manifest.webmanifest', '/icones/icone-192.png', '/favicon.svg']

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(ESSENTIEL)).then(() => self.skipWaiting()))
})

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((cles) => Promise.all(cles.filter((c) => c !== VERSION).map((c) => caches.delete(c))))
      .then(() => self.clients.claim()),
  )
})

const ignore = (url) => /^\/(api|apercu|sites|editeur|health)(\/|$)/.test(url.pathname)

self.addEventListener('fetch', (e) => {
  const req = e.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.origin !== self.location.origin || ignore(url)) return

  // Pages de l'appli : réseau d'abord, page hors ligne sinon
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).catch(() => caches.match('/hors-ligne.html')))
    return
  }

  // Fichiers de l'interface (noms versionnés) : depuis l'appareil, sinon réseau puis gardé
  if (url.pathname.startsWith('/assets/') || url.pathname.startsWith('/icones/')) {
    e.respondWith(
      caches.match(req).then((trouve) => trouve || fetch(req).then((rep) => {
        if (rep.ok) { const copie = rep.clone(); caches.open(VERSION).then((c) => c.put(req, copie)) }
        return rep
      })),
    )
  }
})
