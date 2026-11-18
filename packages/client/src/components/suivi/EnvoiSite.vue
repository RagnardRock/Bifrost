<script setup lang="ts">
/**
 * Choix du site à envoyer : un dossier (glissé ou choisi) ou un ZIP.
 * Un dossier est zippé dans le navigateur ; on émet toujours un ZIP prêt à envoyer.
 */
import { ref } from 'vue'
import { zipSync } from 'fflate'

export interface Envoi { archive: Blob; resume: string }

const emit = defineEmits<{ choisi: [Envoi | null] }>()
const choix = ref<Envoi | null>(null)
const survol = ref(false)
const erreur = ref('')
const occupe = ref(false)
const champDossier = ref<HTMLInputElement | null>(null)
const champZip = ref<HTMLInputElement | null>(null)

const IGNORES = /(^|\/)(\.git|node_modules|ancien-site|outils|__MACOSX)(\/|$)|(^|\/)(\.DS_Store|Thumbs\.db)$/

function poids(octets: number) {
  return octets > 1048576 ? `${(octets / 1048576).toFixed(1)} Mo` : `${Math.max(1, Math.round(octets / 1024))} Ko`
}

function retenir(e: Envoi | null) {
  choix.value = e
  emit('choisi', e)
}

/** Fichiers d'un dossier (chemin relatif → fichier) → ZIP. */
async function zipper(fichiers: { chemin: string; fichier: File }[]) {
  const utiles = fichiers.filter((f) => !IGNORES.test(f.chemin))
  if (!utiles.some((f) => /\.html?$/i.test(f.chemin))) throw new Error('Ce dossier ne contient aucune page HTML.')
  const contenu: Record<string, [Uint8Array, { level: 0 | 6 }]> = {}
  for (const f of utiles) {
    const deja = /\.(jpe?g|png|webp|gif|avif|mp4|webm|zip|pdf|woff2?)$/i.test(f.chemin)
    contenu[f.chemin] = [new Uint8Array(await f.fichier.arrayBuffer()), { level: deja ? 0 : 6 }]
  }
  const zip = zipSync(contenu)
  const total = utiles.reduce((t, f) => t + f.fichier.size, 0)
  return { archive: new Blob([zip as Uint8Array<ArrayBuffer>], { type: 'application/zip' }), resume: `${utiles.length} fichiers · ${poids(total)}` }
}

async function traiter(travail: () => Promise<Envoi>) {
  erreur.value = ''
  occupe.value = true
  try {
    retenir(await travail())
  } catch (e: any) {
    erreur.value = e?.message || 'Impossible de lire ce choix.'
    retenir(null)
  } finally {
    occupe.value = false
  }
}

function depuisZip(f: File) {
  traiter(async () => ({ archive: f, resume: `${f.name} · ${poids(f.size)}` }))
}

function choixDossier(ev: Event) {
  const liste = Array.from((ev.target as HTMLInputElement).files || [])
  ;(ev.target as HTMLInputElement).value = ''
  if (!liste.length) return
  traiter(() => zipper(liste.map((f) => ({ chemin: (f as File & { webkitRelativePath: string }).webkitRelativePath || f.name, fichier: f }))))
}

function choixZip(ev: Event) {
  const f = (ev.target as HTMLInputElement).files?.[0]
  ;(ev.target as HTMLInputElement).value = ''
  if (f) depuisZip(f)
}

/** Parcourt un dossier glissé (API des entrées du glisser-déposer). */
function lireEntree(entree: any, chemin = ''): Promise<{ chemin: string; fichier: File }[]> {
  if (entree.isFile) return new Promise((ok, ko) => entree.file((f: File) => ok([{ chemin: chemin + f.name, fichier: f }]), ko))
  return new Promise((ok, ko) => {
    const lecteur = entree.createReader()
    const tout: any[] = []
    const suite = () => lecteur.readEntries(async (lot: any[]) => {
      if (lot.length) { tout.push(...lot); return suite() }
      const parties = await Promise.all(tout.map((e) => lireEntree(e, `${chemin}${entree.name}/`)))
      ok(parties.flat())
    }, ko)
    suite()
  })
}

function deposer(ev: DragEvent) {
  survol.value = false
  const items = Array.from(ev.dataTransfer?.items || [])
  const entrees = items.map((i) => i.webkitGetAsEntry?.()).filter(Boolean)
  const fichier = ev.dataTransfer?.files?.[0]
  if (entrees.length === 1 && entrees[0]!.isFile && fichier && /\.zip$/i.test(fichier.name)) return depuisZip(fichier)
  if (!entrees.length) { erreur.value = 'Glissez un dossier ou un fichier ZIP.'; return }
  traiter(async () => zipper((await Promise.all(entrees.map((e) => lireEntree(e)))).flat()))
}
</script>

<template>
  <div
    class="depot" :class="{ survol, choisi: choix }"
    @dragover.prevent="survol = true" @dragleave="survol = false" @drop.prevent="deposer"
  >
    <template v-if="occupe">Préparation…</template>
    <template v-else-if="choix">
      <strong>✓ {{ choix.resume }}</strong>
      <button type="button" class="bf-lien" @click="retenir(null)">Changer</button>
    </template>
    <template v-else>
      <span>Glissez ici le dossier du site, ou un ZIP</span>
      <span class="boutons">
        <button type="button" class="glass-button" @click="champDossier?.click()">Choisir un dossier</button>
        <button type="button" class="glass-button" @click="champZip?.click()">Choisir un ZIP</button>
      </span>
    </template>
    <input ref="champDossier" type="file" webkitdirectory multiple hidden @change="choixDossier">
    <input ref="champZip" type="file" accept=".zip,application/zip" hidden @change="choixZip">
  </div>
  <p v-if="erreur" class="text-sm text-red-500" role="alert">{{ erreur }}</p>
</template>

<style scoped>
.depot { display: grid; gap: 10px; justify-items: center; text-align: center; padding: 22px 16px; border: 1.5px dashed var(--bf-bord-fort); border-radius: 14px; background: var(--bf-verre); font-size: 14px; color: var(--bf-doux); transition: border-color .15s, background .15s; }
.depot.survol { border-color: var(--bf-violet); background: rgba(139, 92, 246, .1); }
.depot.choisi { border-style: solid; color: var(--bf-texte); }
.boutons { display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; }
</style>
