<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount, ref } from 'vue'
import { onBeforeRouteLeave } from 'vue-router'
import { useClientContentStore } from '@/stores/client-content.store'
import { useToastStore } from '@/stores/toast.store'
import { clientService } from '@/services/client.service'
import ContentForm from '@/components/content/ContentForm.vue'
import ClientCollectionEditor from '@/components/content/ClientCollectionEditor.vue'
import type { BifrostSchema } from '@bifrost/shared'

const contentStore = useClientContentStore()
const toast = useToastStore()

const isLoading = ref(true)
const schema = ref<BifrostSchema | null>(null)

const hasSchema = computed(() => !!schema.value)
const hasFields = computed(() => {
  if (!schema.value) return false
  return schema.value.fields && Object.keys(schema.value.fields).length > 0
})
const hasCollections = computed(() => {
  if (!schema.value) return false
  return schema.value.collections && Object.keys(schema.value.collections).length > 0
})
const collectionEntries = computed(() => {
  if (!schema.value?.collections) return []
  return Object.entries(schema.value.collections)
})

// Load site schema and content
onMounted(async () => {
  try {
    // Load site info to get schema
    const site = await clientService.getSite()
    schema.value = site.schema

    // Load content and collections in parallel
    const promises: Promise<unknown>[] = []

    if (hasFields.value) {
      promises.push(contentStore.fetchContent())
    }

    if (hasCollections.value) {
      promises.push(contentStore.fetchCollections())
    }

    await Promise.all(promises)
  } catch {
    toast.error('Erreur lors du chargement')
  } finally {
    isLoading.value = false
  }
})

// Cleanup on unmount
onBeforeUnmount(() => {
  contentStore.clearContent()
  contentStore.clearCollections()
})

// Warn about unsaved changes
onBeforeRouteLeave((to, from, next) => {
  if (contentStore.hasUnsavedChanges) {
    const answer = confirm('Vous avez des modifications non enregistrees. Voulez-vous vraiment quitter ?')
    if (!answer) {
      next(false)
      return
    }
  }
  next()
})

// Save content
async function handleSave() {
  try {
    await contentStore.saveContent()
    toast.success('Contenu enregistre')
  } catch {
    toast.error(contentStore.error || 'Erreur lors de la sauvegarde')
  }
}

// Reset changes
function handleReset() {
  if (confirm('Annuler toutes les modifications ?')) {
    contentStore.resetChanges()
    toast.info('Modifications annulees')
  }
}

// Update content
function handleContentUpdate(newContent: Record<string, unknown>) {
  for (const [key, value] of Object.entries(newContent)) {
    contentStore.updateField(key, value)
  }
}
</script>

<template>
  <div>
    <!-- Header -->
    <div class="flex items-center justify-between gap-4 mb-8">
      <div class="flex items-center gap-4">
        <router-link
          to="/dashboard"
          class="glass-button p-2"
          title="Retour au tableau de bord"
        >
          &larr;
        </router-link>
        <div>
          <h1 class="text-3xl font-bold">Edition du contenu</h1>
          <p class="text-gray-500 text-sm">
            Modifiez le contenu de votre site
          </p>
        </div>
      </div>

      <div v-if="hasFields" class="flex items-center gap-3">
        <span
          v-if="contentStore.hasUnsavedChanges"
          class="text-sm text-orange-500"
        >
          Modifications non enregistrees
        </span>
        <button
          v-if="contentStore.hasUnsavedChanges"
          @click="handleReset"
          class="glass-button px-4 py-2"
          :disabled="contentStore.isSaving"
        >
          Annuler
        </button>
        <button
          @click="handleSave"
          class="btn-primary px-4 py-2"
          :disabled="contentStore.isSaving || !contentStore.hasUnsavedChanges"
        >
          {{ contentStore.isSaving ? 'Enregistrement...' : 'Enregistrer' }}
        </button>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="isLoading" class="glass-card p-12 text-center">
      <p class="text-gray-500">Chargement du contenu...</p>
    </div>

    <!-- No schema -->
    <div v-else-if="!hasSchema" class="glass-card p-12 text-center">
      <p class="text-gray-500 mb-4">
        Aucun schema configure pour ce site.
      </p>
      <p class="text-sm text-gray-600">
        Contactez votre administrateur pour configurer le contenu editable.
      </p>
    </div>

    <!-- No content at all -->
    <div v-else-if="!hasFields && !hasCollections" class="glass-card p-12 text-center">
      <p class="text-gray-500 mb-4">
        Le schema ne definit aucun contenu editable.
      </p>
      <p class="text-sm text-gray-600">
        Contactez votre administrateur pour ajouter des champs ou des collections.
      </p>
    </div>

    <!-- Content sections -->
    <div v-else class="space-y-8">
      <!-- Fields section -->
      <div v-if="hasFields" class="glass-card p-6">
        <h2 class="text-xl font-semibold mb-6 pb-2 border-b border-white/10">
          Champs
        </h2>
        <ContentForm
          :schema="schema!"
          :model-value="contentStore.content"
          @update:model-value="handleContentUpdate"
        />
      </div>

      <!-- Collections section -->
      <div v-if="hasCollections" class="glass-card p-6">
        <h2 class="text-xl font-semibold mb-6 pb-2 border-b border-white/10">
          Collections
        </h2>
        <div class="space-y-8">
          <ClientCollectionEditor
            v-for="[type, definition] in collectionEntries"
            :key="type"
            :collection-type="type"
            :definition="definition"
            :items="contentStore.getItems(type)"
          />
        </div>
      </div>
    </div>
  </div>
</template>
