<script setup lang="ts">
/** Mon site › Réseaux : relier Instagram, choisir la rubrique et le mode, importer à la demande. */
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { editeurService, type EtatReseaux } from '@/services/editeur.service'
import { ilYa } from '@/services/suivi.service'

const props = defineProps<{ siteId: string }>()
const emit = defineEmits<{ info: [texte: string] }>()
const route = useRoute()
const router = useRouter()

const etat = ref<EtatReseaux | null>(null)
const occupe = ref(false)
const erreur = ref('')
const compte = computed(() => etat.value?.instagram.compte ?? null)

const RETOURS: Record<string, string> = {
  ok: 'Instagram est relié.',
  refus: 'Instagram n’a pas été relié : l’autorisation a été refusée.',
  erreur: 'Instagram n’a pas pu être relié. Vérifiez que le compte est professionnel ou créateur, puis réessayez.',
}

onMounted(async () => {
  const retour = route.query.instagram as string | undefined
  if (retour) {
    if (retour === 'ok') emit('info', RETOURS.ok!)
    else erreur.value = RETOURS[retour] || ''
    router.replace({ query: { ...route.query, instagram: undefined } })
  }
  await charger()
})

async function charger() {
  try { etat.value = await editeurService.reseaux(props.siteId) } catch { erreur.value = 'Réseaux indisponibles pour le moment.' }
}

async function relier() {
  occupe.value = true
  erreur.value = ''
  try { window.location.href = (await editeurService.connexionInstagram(props.siteId)).adresse } catch { erreur.value = 'Connexion à Instagram impossible pour le moment.'; occupe.value = false }
}

async function regler(r: { collection?: string; mode?: 'brouillon' | 'publier' }) {
  if (!compte.value || !etat.value) return
  try { etat.value.instagram.compte = await editeurService.reglerReseau(props.siteId, compte.value.id, r); emit('info', 'Réglage enregistré') } catch { erreur.value = 'Réglage non enregistré.' }
}

async function importer(recents?: number) {
  if (!compte.value) return
  occupe.value = true
  erreur.value = ''
  try {
    const r = await editeurService.importerReseau(props.siteId, compte.value.id, recents)
    emit('info', !r.importes ? 'Aucun nouveau post' : `${r.importes} post${r.importes > 1 ? 's' : ''} ajouté${r.importes > 1 ? 's' : ''}${r.publie ? ' et publié' + (r.importes > 1 ? 's' : '') : ' au brouillon'}`)
  } catch (e) {
    erreur.value = (e as { response?: { data?: { error?: { message?: string } } } }).response?.data?.error?.message || 'Import impossible.'
  } finally {
    occupe.value = false
    await charger()
  }
}

async function delier() {
  if (!compte.value) return
  occupe.value = true
  try { await editeurService.delierReseau(props.siteId, compte.value.id); emit('info', 'Instagram détaché'); await charger() } finally { occupe.value = false }
}

const NOMS: Record<string, string> = { actualites: 'Actualités', actus: 'Actualités', evenements: 'Événements', blog: 'Blog', articles: 'Articles', galerie: 'Galerie' }
const nomRubrique = (c: string) => NOMS[c] || c.replace(/[-_]+/g, ' ').replace(/^./, (l) => l.toUpperCase())
</script>

<template>
  <div v-if="etat" class="rs">
    <div class="rs-carte">
      <div class="rs-tete">
        <span class="rs-logo" aria-hidden="true">📸</span>
        <div>
          <h2>Instagram</h2>
          <p v-if="compte" class="rs-aide">Relié à <strong>@{{ compte.nom }}</strong></p>
          <p v-else class="rs-aide">Vos posts deviennent des actualités du site, avec leurs photos.</p>
        </div>
      </div>

      <p v-if="erreur" class="rs-erreur" role="alert">{{ erreur }}</p>

      <template v-if="!etat.instagram.configure">
        <p class="rs-aide">Pas encore disponible sur ce serveur : votre développeur doit d’abord le configurer.</p>
      </template>

      <template v-else-if="!compte">
        <p v-if="!etat.collections.length" class="rs-aide">Le site n’a pas encore de rubrique d’actualités pour recevoir les posts. Demandez-la à votre développeur.</p>
        <button v-else type="button" class="rs-btn rs-btn--fort" :disabled="occupe" @click="relier">Relier mon compte Instagram</button>
        <p class="rs-aide">Il faut un compte Instagram professionnel ou créateur (gratuit, dans les réglages d’Instagram). Bifrost peut seulement lire vos posts : il ne publie jamais rien sur Instagram.</p>
      </template>

      <template v-else>
        <label class="rs-champ">Les posts arrivent dans
          <select :value="compte.collection" @change="regler({ collection: ($event.target as HTMLSelectElement).value })">
            <option v-if="!compte.collection" value="" disabled>Choisir…</option>
            <option v-for="c in etat.collections" :key="c" :value="c">{{ nomRubrique(c) }}</option>
          </select>
        </label>
        <fieldset class="rs-choix">
          <legend>Quand un nouveau post arrive</legend>
          <label><input type="radio" name="rs-mode" :checked="compte.mode === 'brouillon'" @change="regler({ mode: 'brouillon' })"> je le relis avant de publier <span class="rs-aide">(notification sur le téléphone)</span></label>
          <label><input type="radio" name="rs-mode" :checked="compte.mode === 'publier'" @change="regler({ mode: 'publier' })"> il est mis en ligne tout de suite</label>
        </fieldset>
        <p class="rs-aide">
          Bifrost regarde toutes les 30 minutes.
          <template v-if="compte.derniereVerif"> Dernière vérification {{ ilYa(compte.derniereVerif) }}.</template>
        </p>
        <p v-if="compte.erreur" class="rs-erreur">{{ compte.erreur }}</p>
        <div class="rs-ligne">
          <button type="button" class="rs-btn rs-btn--fort" :disabled="occupe || !compte.collection" @click="importer()">Vérifier maintenant</button>
          <button type="button" class="rs-btn" :disabled="occupe || !compte.collection" @click="importer(6)">Importer les 6 derniers posts</button>
        </div>
        <div class="rs-ligne">
          <button v-if="compte.erreur" type="button" class="rs-btn" :disabled="occupe" @click="relier">Relier à nouveau</button>
          <button type="button" class="rs-btn rs-btn--discret" :disabled="occupe" @click="delier">Détacher Instagram</button>
        </div>
      </template>
    </div>
    <p class="rs-aide rs-bas">Facebook et YouTube viendront ensuite.</p>
  </div>
</template>

<style scoped>
.rs { display: grid; gap: 12px; }
.rs-carte { display: grid; gap: 14px; padding: 20px; border-radius: 16px; background: var(--bf-verre); border: 1px solid var(--bf-bord); }
.rs-tete { display: flex; gap: 12px; align-items: center; }
.rs-tete h2 { margin: 0; font-size: 17px; }
.rs-logo { display: grid; place-items: center; width: 44px; height: 44px; border-radius: 12px; font-size: 22px; background: linear-gradient(135deg, #f58529, #dd2a7b 50%, #8134af); flex: none; }
.rs-tete p { margin: 2px 0 0; }
.rs-aide { margin: 0; font-size: 13px; font-weight: 400; color: var(--bf-doux); }
.rs-erreur { margin: 0; font-size: 13px; color: #c2410c; }
.rs-champ { display: grid; gap: 6px; font-weight: 600; font-size: 14px; }
.rs-champ select { min-height: 44px; padding: 0 12px; border-radius: 12px; border: 0; box-shadow: inset 0 0 0 1px var(--bf-bord); background: var(--bf-verre-fort); color: var(--bf-texte); font: inherit; font-weight: 400; }
.rs-choix { border: 0; margin: 0; padding: 0; display: grid; gap: 8px; }
.rs-choix legend { padding: 0; margin-bottom: 6px; font-size: 14px; font-weight: 600; }
.rs-choix label { display: flex; gap: 10px; align-items: baseline; flex-wrap: wrap; }
.rs-choix input { accent-color: #8b5cf6; width: 18px; height: 18px; flex: none; align-self: center; }
.rs-ligne { display: flex; gap: 8px; flex-wrap: wrap; }
.rs-btn { min-height: 44px; padding: 0 18px; border: 0; border-radius: 999px; background: var(--bf-verre-fort); box-shadow: inset 0 0 0 1px var(--bf-bord); color: var(--bf-texte); font: inherit; font-size: 14px; font-weight: 600; cursor: pointer; }
.rs-btn--fort { background: var(--bf-degrade); color: #fff; box-shadow: none; }
.rs-btn--discret { background: transparent; box-shadow: none; color: var(--bf-doux); }
.rs-btn:disabled { opacity: .55; cursor: default; }
.rs-bas { text-align: center; }
</style>
