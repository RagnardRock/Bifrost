<script setup lang="ts">
/** Bouton « Installer l'appli » : invite d'Android/Chrome, ou les deux gestes à faire sur iPhone. */
import { ref } from 'vue'
import { useInstallation } from '@/composables/installation'

defineProps<{ compact?: boolean }>()
const emit = defineEmits<{ fait: [] }>()
const { possible, installee, ios, avecInvite, installer } = useInstallation()
const consignes = ref(false)

async function cliquer() {
  if (avecInvite.value) { if (await installer()) emit('fait') }
  else if (ios) consignes.value = !consignes.value
}
</script>

<template>
  <div v-if="possible || installee" class="ia" :class="{ 'ia--compact': compact }">
    <template v-if="installee">
      <p v-if="!compact" class="ia-ok">✓ L’appli Bifrost est installée sur cet appareil.</p>
    </template>
    <template v-else>
      <button type="button" class="ia-btn" :aria-expanded="ios && !avecInvite ? consignes : undefined" @click="cliquer">
        <img src="/icones/icone-192.png" alt="" class="ia-icone" width="28" height="28">
        <span><strong>Installer l’appli</strong><small v-if="!compact">Bifrost sur l’écran d’accueil, en plein écran</small></span>
      </button>
      <ol v-if="consignes" class="ia-consignes">
        <li>Touchez <strong>Partager</strong> <span class="ia-picto" aria-hidden="true">⎋</span> en bas de Safari (ou dans le menu ⋯).</li>
        <li>Choisissez <strong>Sur l’écran d’accueil</strong>, puis <strong>Ajouter</strong>.</li>
      </ol>
    </template>
  </div>
</template>

<style scoped>
.ia { display: grid; gap: 10px; }
.ia-ok { margin: 0; font-size: 14px; color: var(--bf-ok); font-weight: 600; }
.ia-btn { display: flex; align-items: center; gap: 12px; width: 100%; min-height: 52px; padding: 8px 14px; border: 0; border-radius: 14px; background: var(--bf-verre-fort); box-shadow: inset 0 0 0 1px var(--bf-bord); color: var(--bf-texte); font: inherit; text-align: left; cursor: pointer; }
.ia-btn:hover { background: var(--bf-survol, var(--bf-verre-fort)); }
.ia-btn span { display: grid; gap: 1px; }
.ia-btn strong { font-size: 15px; font-weight: 600; }
.ia-btn small { font-size: 13px; color: var(--bf-doux); }
.ia-icone { width: 28px; height: 28px; border-radius: 7px; flex: none; }
.ia-consignes { margin: 0; padding: 12px 14px 12px 32px; border-radius: 12px; background: var(--bf-verre); font-size: 14px; line-height: 1.5; display: grid; gap: 6px; list-style: decimal; }
.ia-picto { display: inline-block; transform: rotate(-90deg); }
.ia--compact .ia-btn { background: none; box-shadow: none; border-radius: 12px; padding: 0 14px; min-height: 50px; }
</style>
