import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { usersService, type CreateUserInput, type UpdateUserInput } from '@/services/users.service'
import type { User } from '@bifrost/shared'

export const useUsersStore = defineStore('users', () => {
  // State
  const users = ref<User[]>([])
  const currentSiteId = ref<string | null>(null)
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  // Getters
  const usersCount = computed(() => users.value.length)
  const hasUsers = computed(() => users.value.length > 0)

  // Actions
  async function fetchUsers(siteId: string) {
    isLoading.value = true
    error.value = null
    currentSiteId.value = siteId

    try {
      users.value = await usersService.listBySite(siteId)
    } catch (e: any) {
      error.value = e.response?.data?.error?.message || 'Erreur lors du chargement des utilisateurs'
      throw e
    } finally {
      isLoading.value = false
    }
  }

  async function createUser(siteId: string, input: CreateUserInput) {
    isLoading.value = true
    error.value = null

    try {
      const newUser = await usersService.create(siteId, input)
      users.value.unshift(newUser)
      return newUser
    } catch (e: any) {
      error.value = e.response?.data?.error?.message || "Erreur lors de la création de l'utilisateur"
      throw e
    } finally {
      isLoading.value = false
    }
  }

  async function updateUser(siteId: string, userId: string, input: UpdateUserInput) {
    isLoading.value = true
    error.value = null

    try {
      const updatedUser = await usersService.update(siteId, userId, input)
      const index = users.value.findIndex((u) => u.id === userId)
      if (index !== -1) {
        users.value[index] = updatedUser
      }
      return updatedUser
    } catch (e: any) {
      error.value = e.response?.data?.error?.message || "Erreur lors de la mise à jour de l'utilisateur"
      throw e
    } finally {
      isLoading.value = false
    }
  }

  async function deleteUser(siteId: string, userId: string) {
    isLoading.value = true
    error.value = null

    try {
      await usersService.delete(siteId, userId)
      users.value = users.value.filter((u) => u.id !== userId)
    } catch (e: any) {
      error.value = e.response?.data?.error?.message || "Erreur lors de la suppression de l'utilisateur"
      throw e
    } finally {
      isLoading.value = false
    }
  }

  function clearUsers() {
    users.value = []
    currentSiteId.value = null
    error.value = null
  }

  function clearError() {
    error.value = null
  }

  return {
    // State
    users,
    currentSiteId,
    isLoading,
    error,
    // Getters
    usersCount,
    hasUsers,
    // Actions
    fetchUsers,
    createUser,
    updateUser,
    deleteUser,
    clearUsers,
    clearError,
  }
})
