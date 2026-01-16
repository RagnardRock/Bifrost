import { defineStore } from 'pinia'
import { ref } from 'vue'
import { clientService } from '@/services/client.service'
import type { CollectionItemResponse } from '@bifrost/shared'

export const useClientContentStore = defineStore('clientContent', () => {
  // Content state
  const content = ref<Record<string, unknown>>({})
  const originalContent = ref<Record<string, unknown>>({})
  const hasUnsavedChanges = ref(false)
  const isLoading = ref(false)
  const isSaving = ref(false)
  const error = ref<string | null>(null)

  // Collections state
  const collections = ref<Record<string, CollectionItemResponse[]>>({})
  const collectionsLoading = ref(false)

  // Content actions
  async function fetchContent() {
    isLoading.value = true
    error.value = null

    try {
      const data = await clientService.getContent()
      content.value = { ...data }
      originalContent.value = { ...data }
      hasUnsavedChanges.value = false
    } catch (e: any) {
      error.value = e.response?.data?.error?.message || 'Erreur lors du chargement'
      throw e
    } finally {
      isLoading.value = false
    }
  }

  function updateField(fieldKey: string, value: unknown) {
    content.value[fieldKey] = value
    hasUnsavedChanges.value = true
  }

  async function saveContent() {
    isSaving.value = true
    error.value = null

    try {
      const data = await clientService.updateContent(content.value)
      content.value = { ...data }
      originalContent.value = { ...data }
      hasUnsavedChanges.value = false
    } catch (e: any) {
      error.value = e.response?.data?.error?.message || 'Erreur lors de la sauvegarde'
      throw e
    } finally {
      isSaving.value = false
    }
  }

  function resetChanges() {
    content.value = { ...originalContent.value }
    hasUnsavedChanges.value = false
  }

  function clearContent() {
    content.value = {}
    originalContent.value = {}
    hasUnsavedChanges.value = false
    error.value = null
  }

  // Collections actions
  async function fetchCollections() {
    collectionsLoading.value = true

    try {
      collections.value = await clientService.getAllCollections()
    } catch (e: any) {
      error.value = e.response?.data?.error?.message || 'Erreur lors du chargement des collections'
      throw e
    } finally {
      collectionsLoading.value = false
    }
  }

  function getItems(collectionType: string): CollectionItemResponse[] {
    return collections.value[collectionType] || []
  }

  async function createItem(collectionType: string, data: Record<string, unknown>) {
    const item = await clientService.createCollectionItem(collectionType, data)
    if (!collections.value[collectionType]) {
      collections.value[collectionType] = []
    }
    collections.value[collectionType].push(item)
    return item
  }

  async function updateItem(collectionType: string, id: string, data: Record<string, unknown>) {
    const item = await clientService.updateCollectionItem(collectionType, id, data)
    const items = collections.value[collectionType] || []
    const index = items.findIndex((i) => i.id === id)
    if (index !== -1) {
      items[index] = item
    }
    return item
  }

  async function deleteItem(collectionType: string, id: string) {
    await clientService.deleteCollectionItem(collectionType, id)
    const items = collections.value[collectionType] || []
    const index = items.findIndex((i) => i.id === id)
    if (index !== -1) {
      items.splice(index, 1)
    }
  }

  async function reorderItems(collectionType: string, itemIds: string[]) {
    const items = await clientService.reorderCollectionItems(collectionType, itemIds)
    collections.value[collectionType] = items
    return items
  }

  function clearCollections() {
    collections.value = {}
  }

  return {
    // Content state
    content,
    hasUnsavedChanges,
    isLoading,
    isSaving,
    error,
    // Content actions
    fetchContent,
    updateField,
    saveContent,
    resetChanges,
    clearContent,
    // Collections state
    collections,
    collectionsLoading,
    // Collections actions
    fetchCollections,
    getItems,
    createItem,
    updateItem,
    deleteItem,
    reorderItems,
    clearCollections,
  }
})
