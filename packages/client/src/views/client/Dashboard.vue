<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useAuthStore } from '@/stores/auth.store'
import { clientService } from '@/services/client.service'
import type { BifrostSchema } from '@bifrost/shared'

const auth = useAuthStore()

const isLoading = ref(true)
const site = ref<{ id: string; name: string; domain: string; schema: BifrostSchema | null } | null>(null)
const error = ref<string | null>(null)

const hasSchema = computed(() => !!site.value?.schema)
const hasFields = computed(() => {
  if (!site.value?.schema) return false
  return site.value.schema.fields && Object.keys(site.value.schema.fields).length > 0
})
const hasCollections = computed(() => {
  if (!site.value?.schema) return false
  return site.value.schema.collections && Object.keys(site.value.schema.collections).length > 0
})

const fieldCount = computed(() => {
  if (!site.value?.schema?.fields) return 0
  return Object.keys(site.value.schema.fields).length
})

const collectionCount = computed(() => {
  if (!site.value?.schema?.collections) return 0
  return Object.keys(site.value.schema.collections).length
})

onMounted(async () => {
  try {
    site.value = await clientService.getSite()
  } catch (e: any) {
    error.value = e.response?.data?.error?.message || 'Erreur lors du chargement'
  } finally {
    isLoading.value = false
  }
})
</script>

<template>
  <div>
    <!-- Header -->
    <div class="mb-8">
      <h1 class="text-3xl font-bold mb-2">Tableau de bord</h1>
      <p class="text-gray-500">
        Bienvenue, {{ auth.client?.email }}
      </p>
    </div>

    <!-- Loading -->
    <div v-if="isLoading" class="glass-card p-12 text-center">
      <p class="text-gray-500">Chargement...</p>
    </div>

    <!-- Error -->
    <div v-else-if="error" class="glass-card p-12 text-center">
      <p class="text-red-500">{{ error }}</p>
    </div>

    <!-- Content -->
    <div v-else class="space-y-6">
      <!-- Site info -->
      <div class="glass-card p-6">
        <h2 class="text-xl font-semibold mb-4">Votre site</h2>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <p class="text-sm text-gray-500">Nom</p>
            <p class="font-medium">{{ site?.name }}</p>
          </div>
          <div>
            <p class="text-sm text-gray-500">Domaine</p>
            <p class="font-medium">{{ site?.domain }}</p>
          </div>
        </div>
      </div>

      <!-- Schema summary -->
      <div class="glass-card p-6">
        <h2 class="text-xl font-semibold mb-4">Contenu disponible</h2>

        <div v-if="!hasSchema" class="text-gray-500">
          <p>Aucun schema n'est configure pour votre site.</p>
          <p class="text-sm mt-2">Contactez votre administrateur pour configurer le contenu editable.</p>
        </div>

        <div v-else class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div class="p-4 rounded-lg bg-blue-500/10 border border-blue-500/20">
            <p class="text-3xl font-bold text-blue-500">{{ fieldCount }}</p>
            <p class="text-sm text-gray-500">Champs editables</p>
          </div>
          <div class="p-4 rounded-lg bg-purple-500/10 border border-purple-500/20">
            <p class="text-3xl font-bold text-purple-500">{{ collectionCount }}</p>
            <p class="text-sm text-gray-500">Collections</p>
          </div>
        </div>

        <div v-if="hasSchema" class="mt-6">
          <router-link to="/dashboard/content" class="btn-primary inline-block">
            Editer le contenu
          </router-link>
        </div>
      </div>
    </div>
  </div>
</template>
