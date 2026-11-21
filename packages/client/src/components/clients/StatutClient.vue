<script setup lang="ts">
import { STATUTS, type StatutClient } from '@/services/clients.service'
defineProps<{ statut: StatutClient | string }>()
</script>

<template>
  <span class="statut" :class="`statut--${statut}`">{{ STATUTS[statut as StatutClient] ?? statut }}</span>
</template>

<style scoped>
.statut { display: inline-block; padding: 2px 10px; border-radius: 999px; font-size: 12px; font-weight: 600; background: var(--bf-verre-fort); color: var(--bf-texte); white-space: nowrap; }
.statut--actif { background: rgba(34, 197, 94, .15); color: var(--bf-ok); }
.statut--essai { background: rgba(59, 130, 246, .15); color: #3b82f6; }
.statut--suspendu { background: rgba(224, 122, 74, .16); color: var(--bf-accent); }
.statut--termine { opacity: .7; }
</style>
