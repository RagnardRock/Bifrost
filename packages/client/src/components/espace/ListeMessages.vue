<script setup lang="ts">
/**
 * Liste des messages reçus par les formulaires : lire, répondre, marquer non lu, supprimer.
 * Sert pour un site (Gérer › Messages) et pour tous les sites à la fois (Messages de l'espace).
 */
import { ref } from 'vue'
import { editeurService, type Message } from '@/services/editeur.service'

export type MessageSite = Message & { siteId: string; siteNom: string }

defineProps<{ messages: MessageSite[]; avecSite?: boolean }>()
const emit = defineEmits<{ change: []; supprime: [id: string]; erreur: [texte: string] }>()

const ouvert = ref<string | null>(null)
const aSupprimer = ref<MessageSite | null>(null)

const titre = (m: Message) => m.champs.find((c) => c.valeur && c.valeur !== m.email)?.valeur.slice(0, 80) || m.email || 'Message'
const apercu = (m: Message) => m.champs.filter((c) => c.valeur && c.valeur !== m.email && c.valeur !== titre(m)).map((c) => c.valeur).join(' · ').slice(0, 140)
const repondre = (m: MessageSite) => `mailto:${m.email}?subject=${encodeURIComponent(`Re : votre message sur ${m.siteNom || 'notre site'}`)}`
const date = (d: string) => new Date(d).toLocaleString('fr-FR', { dateStyle: 'long', timeStyle: 'short' })
const message = (e: unknown, defaut: string) => (e as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message || defaut

async function lire(m: MessageSite) {
  ouvert.value = ouvert.value === m.id ? null : m.id
  if (m.lu) return
  m.lu = true
  try { await editeurService.marquerLu(m.siteId, m.id, true); emit('change') } catch { m.lu = false }
}
async function nonLu(m: MessageSite) {
  try { await editeurService.marquerLu(m.siteId, m.id, false); m.lu = false; ouvert.value = null; emit('change') } catch (e) { emit('erreur', message(e, 'Action impossible.')) }
}
async function supprimer() {
  const m = aSupprimer.value
  aSupprimer.value = null
  if (!m) return
  try {
    await editeurService.supprimerMessage(m.siteId, m.id)
    emit('supprime', m.id)
    emit('change')
  } catch (e) { emit('erreur', message(e, 'Message non supprimé.')) }
}
</script>

<template>
  <ul class="lm">
    <li v-for="m in messages" :key="m.id" :class="{ 'lm-non-lu': !m.lu }">
      <button type="button" class="lm-tete" :aria-expanded="ouvert === m.id" @click="lire(m)">
        <span class="lm-point" aria-hidden="true" />
        <span class="lm-resume">
          <strong>{{ titre(m) }}</strong>
          <span><em v-if="avecSite" class="lm-site">{{ m.siteNom }}</em>{{ apercu(m) }}</span>
        </span>
        <time :datetime="m.createdAt">{{ date(m.createdAt) }}</time>
      </button>
      <div v-if="ouvert === m.id" class="lm-corps">
        <dl>
          <template v-for="c in m.champs" :key="c.nom"><dt>{{ c.libelle }}</dt><dd>{{ c.valeur || '—' }}</dd></template>
        </dl>
        <div class="lm-ligne">
          <a v-if="m.email" :href="repondre(m)" class="lm-btn lm-btn--fort">Répondre</a>
          <button type="button" class="lm-btn" @click="nonLu(m)">Marquer non lu</button>
          <button type="button" class="lm-btn lm-rouge" @click="aSupprimer = m">Supprimer</button>
        </div>
      </div>
    </li>
  </ul>

  <div v-if="aSupprimer" class="lm-fond" @click.self="aSupprimer = null">
    <div class="lm-fenetre" role="dialog" aria-modal="true">
      <p>Supprimer ce message ? Il ne pourra pas être récupéré.</p>
      <div class="lm-ligne lm-fin">
        <button type="button" class="lm-btn" @click="aSupprimer = null">Annuler</button>
        <button type="button" class="lm-btn lm-btn--danger" @click="supprimer">Supprimer</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.lm { list-style: none; margin: 0; padding: 0; display: grid; gap: 6px; }
.lm > li { border-radius: 14px; background: var(--bf-verre); }
.lm-tete { width: 100%; display: flex; align-items: center; gap: 12px; padding: 14px; border: 0; background: none; color: inherit; font: inherit; text-align: left; cursor: pointer; border-radius: 14px; }
.lm-tete:hover { background: var(--bf-verre-fort); }
.lm-point { width: 8px; height: 8px; flex: none; border-radius: 50%; }
.lm-non-lu .lm-point { background: var(--bf-accent); }
.lm-resume { flex: 1; min-width: 0; display: grid; }
.lm-resume strong, .lm-resume > span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.lm-resume strong { font-size: 15px; font-weight: 500; }
.lm-non-lu .lm-resume strong { font-weight: 700; }
.lm-resume > span { font-size: 13px; color: var(--bf-doux); }
.lm-site { font-style: normal; font-weight: 600; color: var(--bf-fort); margin-right: 8px; }
.lm-tete time { flex: none; font-size: 12px; color: var(--bf-doux); }
.lm-corps { padding: 0 14px 16px 34px; display: grid; gap: 14px; }
.lm-corps dl { margin: 0; display: grid; gap: 4px 16px; grid-template-columns: minmax(90px, max-content) 1fr; font-size: 15px; }
.lm-corps dt { color: var(--bf-doux); }
.lm-corps dd { margin: 0; white-space: pre-wrap; overflow-wrap: anywhere; }
.lm-ligne { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.lm-fin { justify-content: flex-end; }
.lm-btn { display: inline-flex; align-items: center; justify-content: center; min-height: 44px; padding: 0 18px; border: 0; border-radius: 999px; background: var(--bf-verre-fort); box-shadow: inset 0 0 0 1px var(--bf-bord); color: var(--bf-texte); font: inherit; font-size: 14px; font-weight: 600; text-decoration: none; cursor: pointer; white-space: nowrap; }
.lm-btn:hover { background: var(--bf-survol); }
.lm-btn--fort { background: var(--bf-degrade); color: #fff; box-shadow: none; }
.lm-btn--danger { background: #c0392b; color: #fff; box-shadow: none; }
.lm-rouge { color: var(--bf-danger); }
.lm-fond { position: fixed; inset: 0; z-index: 40; display: grid; place-items: center; padding: 16px; background: var(--bf-voile); backdrop-filter: blur(4px); }
.lm-fenetre { width: 100%; max-width: 400px; display: grid; gap: 16px; padding: 24px; border-radius: 20px; background: var(--bf-surface); border: 1px solid var(--bf-bord); box-shadow: 0 30px 80px rgba(0, 0, 0, .5); }
.lm-fenetre p { margin: 0; }
@media (max-width: 560px) {
  .lm-tete time { display: none; }
  .lm-corps { padding-left: 14px; }
  .lm-corps dl { grid-template-columns: 1fr; }
  .lm-corps dd { margin-bottom: 8px; }
}
</style>
