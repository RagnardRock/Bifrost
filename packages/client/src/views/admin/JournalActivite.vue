<script setup lang="ts">
/** Journal de tous les sites, filtrable par site. */
import { onMounted, ref, watch } from 'vue'
import Journal from '@/components/suivi/Journal.vue'
import { suiviService, type Evenement, type SiteSuivi } from '@/services/suivi.service'

const sites = ref<SiteSuivi[]>([])
const site = ref('')
const evenements = ref<Evenement[] | null>(null)

async function charger() {
  evenements.value = await suiviService.activite(site.value || undefined, 300)
}
watch(site, charger)
onMounted(async () => {
  sites.value = await suiviService.sites()
  await charger()
})
</script>

<template>
  <div class="max-w-4xl">
    <div class="flex flex-wrap items-end justify-between gap-4 mb-10">
      <div>
        <span class="surtitre">Espace développeur</span>
        <h1>Activité</h1>
      </div>
      <select v-model="site" class="input-field max-w-xs" aria-label="Filtrer par site">
        <option value="">Tous les sites</option>
        <option v-for="s in sites" :key="s.id" :value="s.id">{{ s.nom }}</option>
      </select>
    </div>
    <div class="glass-card p-2">
      <p v-if="!evenements" class="p-4 text-gray-500">Chargement…</p>
      <Journal v-else :evenements="evenements" :avec-site="!site" />
    </div>
  </div>
</template>
