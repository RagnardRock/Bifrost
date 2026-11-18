<script setup lang="ts">
import { TYPES, ilYa, type Evenement } from '@/services/suivi.service'

defineProps<{ evenements: Evenement[]; avecSite?: boolean }>()
const type = (t: string) => TYPES[t] || { icone: '•', texte: t }
</script>

<template>
  <p v-if="!evenements.length" class="text-sm text-gray-500">Rien pour l’instant.</p>
  <ol v-else class="journal">
    <li v-for="e in evenements" :key="e.id">
      <span class="icone" aria-hidden="true">{{ type(e.type).icone }}</span>
      <div class="min-w-0">
        <p>
          <strong>{{ e.auteur || 'Quelqu’un' }}</strong>
          {{ type(e.type).texte }}
          <span v-if="e.detail" class="detail">{{ e.detail }}</span>
          <template v-if="avecSite"> · <router-link :to="`/admin/sites/${e.site.id}`" class="lien">{{ e.site.nom }}</router-link></template>
        </p>
        <time :datetime="e.date" :title="new Date(e.date).toLocaleString('fr-FR')">{{ ilYa(e.date) }}</time>
      </div>
    </li>
  </ol>
</template>

<style scoped>
.journal { list-style: none; margin: 0; padding: 0; display: grid; gap: 2px; }
.journal li { display: flex; gap: 12px; align-items: flex-start; padding: 10px 12px; border-radius: 10px; }
.journal li:hover { background: var(--bf-verre); }
.icone { width: 28px; flex: none; text-align: center; font-size: 18px; line-height: 1.4; }
.journal p { margin: 0; font-size: 14px; overflow-wrap: anywhere; }
.detail { font-family: ui-monospace, monospace; font-size: 12.5px; padding: 1px 6px; border-radius: 6px; background: var(--bf-verre-fort); }
.journal time { font-size: 12px; color: var(--bf-doux); }
.lien { color: var(--bf-accent); }
.lien:hover { text-decoration: underline; }
</style>
