import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { contentService, type ContentData } from '@/services/content.service'

export const useContentStore = defineStore('content', () => {
  // State
  const content = ref<ContentData>({})
  const currentSiteId = ref<string | null>(null)
  const isLoading = ref(false)
  const isSaving = ref(false)
  const error = ref<string | null>(null)
  const hasUnsavedChanges = ref(false)

  // Original content for change detection
  const originalContent = ref<ContentData>({})

  // Getters
  const isEmpty = computed(() => Object.keys(content.value).length === 0)

  // Actions
  async function fetchContent(siteId: string) {
    isLoading.value = true
    error.value = null
    currentSiteId.value = siteId

    try {
      const data = await contentService.getContent(siteId)
      content.value = data
      originalContent.value = JSON.parse(JSON.stringify(data))
      hasUnsavedChanges.value = false
    } catch (e: any) {
      error.value = e.response?.data?.error?.message || 'Erreur lors du chargement du contenu'
      throw e
    } finally {
      isLoading.value = false
    }
  }

  async function saveContent(siteId: string) {
    if (!hasUnsavedChanges.value) return

    isSaving.value = true
    error.value = null

    try {
      const data = await contentService.updateContent(siteId, content.value)
      content.value = data
      originalContent.value = JSON.parse(JSON.stringify(data))
      hasUnsavedChanges.value = false
      return data
    } catch (e: any) {
      error.value = e.response?.data?.error?.message || 'Erreur lors de la sauvegarde'
      throw e
    } finally {
      isSaving.value = false
    }
  }

  function updateField(fieldKey: string, value: unknown) {
    content.value[fieldKey] = value
    hasUnsavedChanges.value = true
  }

  function resetChanges() {
    content.value = JSON.parse(JSON.stringify(originalContent.value))
    hasUnsavedChanges.value = false
  }

  function clearContent() {
    content.value = {}
    originalContent.value = {}
    currentSiteId.value = null
    hasUnsavedChanges.value = false
    error.value = null
  }

  return {
    // State
    content,
    currentSiteId,
    isLoading,
    isSaving,
    error,
    hasUnsavedChanges,
    // Getters
    isEmpty,
    // Actions
    fetchContent,
    saveContent,
    updateField,
    resetChanges,
    clearContent,
  }
})
