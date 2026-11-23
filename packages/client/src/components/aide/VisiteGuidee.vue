<script setup lang="ts">
/**
 * Visite guidée : une bulle à la fois, posée à côté d'un élément de l'écran.
 * Chaque étape vise une liste de sélecteurs : le premier élément visible est montré
 * (sur téléphone, un bouton caché laisse la place au menu « ⋯ »).
 */
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'

export interface EtapeVisite { cibles: string[]; titre: string; texte: string }

const props = defineProps<{ etapes: EtapeVisite[] }>()
const emit = defineEmits<{ fin: [] }>()

const i = ref(0)
const zone = ref<DOMRect | null>(null)
const etape = computed(() => props.etapes[i.value])
const derniere = computed(() => i.value === props.etapes.length - 1)

function visible(el: Element) {
  const r = el.getBoundingClientRect()
  return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden'
}
function mesurer() {
  const el = etape.value?.cibles.map((s) => document.querySelector(s)).find((e): e is Element => !!e && visible(e))
  zone.value = el ? el.getBoundingClientRect() : null
}

// Bulle sous l'élément, ou au-dessus s'il est en bas de l'écran ; au centre sans élément
const style = computed(() => {
  const z = zone.value
  const largeur = Math.min(320, window.innerWidth - 32)
  if (!z) return { width: `${largeur}px`, left: '50%', top: '50%', transform: 'translate(-50%, -50%)' }
  const left = Math.max(16, Math.min(window.innerWidth - largeur - 16, z.left + z.width / 2 - largeur / 2))
  // Grand élément (l'aperçu du site) : la bulle se pose dedans, en haut
  if (z.height > window.innerHeight * 0.5) return { width: `${largeur}px`, left: `${left}px`, top: `${Math.max(16, z.top + 24)}px` }
  const enBas = z.bottom > window.innerHeight * 0.6
  return enBas
    ? { width: `${largeur}px`, left: `${left}px`, bottom: `${window.innerHeight - z.top + 12}px` }
    : { width: `${largeur}px`, left: `${left}px`, top: `${z.bottom + 12}px` }
})
const halo = computed(() => {
  const z = zone.value
  if (!z) return null
  const m = 6
  return { left: `${z.left - m}px`, top: `${z.top - m}px`, width: `${z.width + 2 * m}px`, height: `${z.height + 2 * m}px` }
})

function suivant() { if (derniere.value) emit('fin'); else i.value++ }
function precedent() { if (i.value > 0) i.value-- }
function touche(e: KeyboardEvent) {
  if (e.key === 'Escape') emit('fin')
  else if (e.key === 'ArrowRight' || e.key === 'Enter') suivant()
  else if (e.key === 'ArrowLeft') precedent()
}

watch(i, () => nextTick(mesurer))
onMounted(() => { mesurer(); window.addEventListener('resize', mesurer); window.addEventListener('keydown', touche) })
onBeforeUnmount(() => { window.removeEventListener('resize', mesurer); window.removeEventListener('keydown', touche) })
</script>

<template>
  <div class="vg" role="dialog" aria-modal="true" :aria-label="`Visite guidée, étape ${i + 1} sur ${etapes.length}`">
    <div v-if="halo" class="vg-halo" :style="halo" />
    <div v-else class="vg-voile" />
    <div class="vg-bulle" :style="style">
      <span v-if="etapes.length > 1" class="vg-compte">{{ i + 1 }} / {{ etapes.length }}</span>
      <strong class="vg-titre">{{ etape?.titre }}</strong>
      <p class="vg-texte">{{ etape?.texte }}</p>
      <div class="vg-boutons">
        <button v-if="!derniere" type="button" class="vg-passer" @click="emit('fin')">Passer la visite</button><span v-else />
        <span>
          <button v-if="i > 0" type="button" class="vg-btn vg-btn--clair" @click="precedent">Précédent</button>
          <button type="button" class="vg-btn" autofocus @click="suivant">{{ !derniere ? 'Suivant' : etapes.length > 1 ? 'C’est parti' : 'Compris' }}</button>
        </span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.vg { position: fixed; inset: 0; z-index: 60; }
.vg-voile { position: fixed; inset: 0; background: rgba(0, 0, 0, .45); }
/* le halo assombrit tout le reste avec une ombre immense */
.vg-halo { position: fixed; border-radius: 14px; box-shadow: 0 0 0 9999px rgba(0, 0, 0, .45), 0 0 0 3px #f59e0b; transition: all .25s ease; pointer-events: none; }
.vg-bulle { position: fixed; display: grid; gap: 8px; padding: 16px 18px; border-radius: 16px; background: var(--bf-surface); backdrop-filter: blur(20px); border: 1px solid var(--bf-bord); color: var(--bf-texte); box-shadow: 0 20px 60px rgba(0, 0, 0, .45); }
.vg-compte { font-size: 12px; color: var(--bf-doux); }
.vg-titre { font-size: 16px; }
.vg-texte { margin: 0; font-size: 14px; line-height: 1.5; }
.vg-boutons { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-top: 4px; }
.vg-boutons span { display: flex; gap: 8px; }
.vg-passer { background: none; border: 0; color: var(--bf-doux); font: inherit; font-size: 13px; cursor: pointer; padding: 6px 0; }
.vg-btn { border: 0; border-radius: 999px; padding: 8px 16px; font: inherit; font-size: 14px; font-weight: 600; cursor: pointer; background: var(--bf-degrade); color: #fff; }
.vg-btn--clair { background: var(--bf-verre); color: var(--bf-texte); box-shadow: inset 0 0 0 1px var(--bf-bord); }
</style>
