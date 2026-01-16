<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount } from 'vue'
import { useRoute, useRouter, onBeforeRouteLeave } from 'vue-router'
import { useSitesStore } from '@/stores/sites.store'
import { useContentStore } from '@/stores/content.store'
import { useCollectionsStore } from '@/stores/collections.store'
import { useToastStore } from '@/stores/toast.store'
import ContentForm from '@/components/content/ContentForm.vue'
import CollectionEditor from '@/components/content/CollectionEditor.vue'
import type { BifrostSchema } from '@bifrost/shared'

const route = useRoute()
const router = useRouter()
const sites = useSitesStore()
const contentStore = useContentStore()
const collectionsStore = useCollectionsStore()
const toast = useToastStore()

const siteId = computed(() => route.params.id as string)
const schema = computed(() => sites.currentSite?.schema as BifrostSchema | null)
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

// Load site and content
onMounted(async () => {
  try {
    // Load site if not already loaded
    if (!sites.currentSite || sites.currentSite.id !== siteId.value) {
      await sites.fetchSite(siteId.value)
    }

    // Load content and collections in parallel
    const promises: Promise<unknown>[] = []

    if (hasFields.value) {
      promises.push(contentStore.fetchContent(siteId.value))
    }

    if (hasCollections.value) {
      promises.push(collectionsStore.fetchCollections(siteId.value))
    }

    await Promise.all(promises)
  } catch {
    toast.error('Erreur lors du chargement')
    router.push('/admin/sites')
  }
})

// Cleanup on unmount
onBeforeUnmount(() => {
  contentStore.clearContent()
  collectionsStore.clearCollections()
})

// Warn about unsaved changes
onBeforeRouteLeave((to, from, next) => {
  if (contentStore.hasUnsavedChanges) {
    const answer = confirm('Vous avez des modifications non enregistrées. Voulez-vous vraiment quitter ?')
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
    await contentStore.saveContent(siteId.value)
    toast.success('Contenu enregistré')
  } catch {
    toast.error(contentStore.error || 'Erreur lors de la sauvegarde')
  }
}

// Reset changes
function handleReset() {
  if (confirm('Annuler toutes les modifications ?')) {
    contentStore.resetChanges()
    toast.info('Modifications annulées')
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
          :to="`/admin/sites/${siteId}`"
          class="glass-button p-2"
          title="Retour au site"
        >
          &larr;
        </router-link>
        <div>
          <h1 class="text-3xl font-bold">Édition du contenu</h1>
          <p class="text-gray-500 text-sm">
            {{ sites.currentSite?.name }}
          </p>
        </div>
      </div>

      <div v-if="hasFields" class="flex items-center gap-3">
        <span
          v-if="contentStore.hasUnsavedChanges"
          class="text-sm text-orange-500"
        >
          Modifications non enregistrées
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
    <div v-if="contentStore.isLoading" class="glass-card p-12 text-center">
      <p class="text-gray-500">Chargement du contenu...</p>
    </div>

    <!-- No schema -->
    <div v-else-if="!hasSchema" class="glass-card p-12 text-center">
      <p class="text-gray-500 mb-4">
        Aucun schéma configuré pour ce site.
      </p>
      <router-link
        :to="`/admin/sites/${siteId}`"
        class="text-blue-500 hover:underline"
      >
        Configurer le schéma
      </router-link>
    </div>

    <!-- No content at all -->
    <div v-else-if="!hasFields && !hasCollections" class="glass-card p-12 text-center">
      <p class="text-gray-500 mb-4">
        Le schéma ne définit aucun contenu éditable.
      </p>
      <p class="text-sm text-gray-600">
        Ajoutez des champs ou des collections dans le schéma YAML.
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
          <CollectionEditor
            v-for="[type, definition] in collectionEntries"
            :key="type"
            :site-id="siteId"
            :collection-type="type"
            :definition="definition"
            :items="collectionsStore.getItems(type)"
          />
        </div>
      </div>
    </div>
  </div>
</template>
