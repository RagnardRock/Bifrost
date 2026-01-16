import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { sitesService } from '@/services/sites.service'
import type { Site, SiteCreateInput } from '@bifrost/shared'

export const useSitesStore = defineStore('sites', () => {
  // State
  const sites = ref<Site[]>([])
  const currentSite = ref<Site | null>(null)
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  // Getters
  const sitesCount = computed(() => sites.value.length)
  const hasSites = computed(() => sites.value.length > 0)

  // Actions
  async function fetchSites() {
    isLoading.value = true
    error.value = null

    try {
      sites.value = await sitesService.list()
    } catch (e: any) {
      error.value = e.response?.data?.error?.message || 'Erreur lors du chargement des sites'
      throw e
    } finally {
      isLoading.value = false
    }
  }

  async function fetchSite(id: string) {
    isLoading.value = true
    error.value = null

    try {
      currentSite.value = await sitesService.getById(id)
      return currentSite.value
    } catch (e: any) {
      error.value = e.response?.data?.error?.message || 'Erreur lors du chargement du site'
      throw e
    } finally {
      isLoading.value = false
    }
  }

  async function createSite(input: SiteCreateInput) {
    isLoading.value = true
    error.value = null

    try {
      const newSite = await sitesService.create(input)
      sites.value.unshift(newSite)
      return newSite
    } catch (e: any) {
      error.value = e.response?.data?.error?.message || 'Erreur lors de la création du site'
      throw e
    } finally {
      isLoading.value = false
    }
  }

  async function updateSite(id: string, input: Partial<SiteCreateInput>) {
    isLoading.value = true
    error.value = null

    try {
      const updatedSite = await sitesService.update(id, input)
      const index = sites.value.findIndex((s) => s.id === id)
      if (index !== -1) {
        sites.value[index] = updatedSite
      }
      if (currentSite.value?.id === id) {
        currentSite.value = updatedSite
      }
      return updatedSite
    } catch (e: any) {
      error.value = e.response?.data?.error?.message || 'Erreur lors de la mise à jour du site'
      throw e
    } finally {
      isLoading.value = false
    }
  }

  async function deleteSite(id: string) {
    isLoading.value = true
    error.value = null

    try {
      await sitesService.delete(id)
      sites.value = sites.value.filter((s) => s.id !== id)
      if (currentSite.value?.id === id) {
        currentSite.value = null
      }
    } catch (e: any) {
      error.value = e.response?.data?.error?.message || 'Erreur lors de la suppression du site'
      throw e
    } finally {
      isLoading.value = false
    }
  }

  async function regenerateApiKey(id: string) {
    isLoading.value = true
    error.value = null

    try {
      const updatedSite = await sitesService.regenerateApiKey(id)
      const index = sites.value.findIndex((s) => s.id === id)
      if (index !== -1) {
        sites.value[index] = updatedSite
      }
      if (currentSite.value?.id === id) {
        currentSite.value = updatedSite
      }
      return updatedSite
    } catch (e: any) {
      error.value = e.response?.data?.error?.message || 'Erreur lors de la régénération de la clé'
      throw e
    } finally {
      isLoading.value = false
    }
  }

  function clearError() {
    error.value = null
  }

  return {
    // State
    sites,
    currentSite,
    isLoading,
    error,
    // Getters
    sitesCount,
    hasSites,
    // Actions
    fetchSites,
    fetchSite,
    createSite,
    updateSite,
    deleteSite,
    regenerateApiKey,
    clearError,
  }
})
