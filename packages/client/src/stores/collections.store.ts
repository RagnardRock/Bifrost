import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import {
  collectionsService,
  type CollectionItem,
  type CollectionsData,
} from '@/services/collections.service'

export const useCollectionsStore = defineStore('collections', () => {
  // State
  const collections = ref<CollectionsData>({})
  const currentSiteId = ref<string | null>(null)
  const isLoading = ref(false)
  const isSaving = ref(false)
  const error = ref<string | null>(null)

  // Getters
  const collectionTypes = computed(() => Object.keys(collections.value))
  const hasCollections = computed(() => collectionTypes.value.length > 0)

  function getItems(collectionType: string): CollectionItem[] {
    return collections.value[collectionType] || []
  }

  function getItemCount(collectionType: string): number {
    return getItems(collectionType).length
  }

  // Actions
  async function fetchCollections(siteId: string) {
    isLoading.value = true
    error.value = null
    currentSiteId.value = siteId

    try {
      collections.value = await collectionsService.getAllCollections(siteId)
    } catch (e: any) {
      error.value = e.response?.data?.error?.message || 'Erreur lors du chargement'
      throw e
    } finally {
      isLoading.value = false
    }
  }

  async function createItem(
    siteId: string,
    collectionType: string,
    data: Record<string, unknown>
  ) {
    isSaving.value = true
    error.value = null

    try {
      const item = await collectionsService.createItem(siteId, collectionType, data)

      // Add to local state
      if (!collections.value[collectionType]) {
        collections.value[collectionType] = []
      }
      collections.value[collectionType].push(item)

      return item
    } catch (e: any) {
      error.value = e.response?.data?.error?.message || 'Erreur lors de la création'
      throw e
    } finally {
      isSaving.value = false
    }
  }

  async function updateItem(
    siteId: string,
    collectionType: string,
    itemId: string,
    data: Record<string, unknown>
  ) {
    isSaving.value = true
    error.value = null

    try {
      const item = await collectionsService.updateItem(siteId, collectionType, itemId, data)

      // Update local state
      const items = collections.value[collectionType] || []
      const index = items.findIndex((i) => i.id === itemId)
      if (index !== -1) {
        items[index] = item
      }

      return item
    } catch (e: any) {
      error.value = e.response?.data?.error?.message || 'Erreur lors de la mise à jour'
      throw e
    } finally {
      isSaving.value = false
    }
  }

  async function deleteItem(siteId: string, collectionType: string, itemId: string) {
    isSaving.value = true
    error.value = null

    try {
      await collectionsService.deleteItem(siteId, collectionType, itemId)

      // Remove from local state
      const items = collections.value[collectionType] || []
      collections.value[collectionType] = items.filter((i) => i.id !== itemId)
    } catch (e: any) {
      error.value = e.response?.data?.error?.message || 'Erreur lors de la suppression'
      throw e
    } finally {
      isSaving.value = false
    }
  }

  async function reorderItems(siteId: string, collectionType: string, itemIds: string[]) {
    isSaving.value = true
    error.value = null

    try {
      const items = await collectionsService.reorderItems(siteId, collectionType, itemIds)
      collections.value[collectionType] = items
      return items
    } catch (e: any) {
      error.value = e.response?.data?.error?.message || 'Erreur lors du réordonnancement'
      throw e
    } finally {
      isSaving.value = false
    }
  }

  function clearCollections() {
    collections.value = {}
    currentSiteId.value = null
    error.value = null
  }

  return {
    // State
    collections,
    currentSiteId,
    isLoading,
    isSaving,
    error,
    // Getters
    collectionTypes,
    hasCollections,
    getItems,
    getItemCount,
    // Actions
    fetchCollections,
    createItem,
    updateItem,
    deleteItem,
    reorderItems,
    clearCollections,
  }
})
