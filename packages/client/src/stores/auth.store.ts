import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { authService } from '@/services/auth.service'
import type { Admin } from '@bifrost/shared'

interface ClientUser {
  id: string
  email: string
  siteId: string
  siteName?: string
  createdAt: Date
  updatedAt: Date
}

export const useAuthStore = defineStore('auth', () => {
  const router = useRouter()

  // State
  const token = ref<string | null>(localStorage.getItem('token'))
  const role = ref<'admin' | 'client' | null>(localStorage.getItem('role') as 'admin' | 'client' | null)
  const admin = ref<Admin | null>(null)
  const client = ref<ClientUser | null>(null)
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  // Getters
  const isAuthenticated = computed(() => !!token.value)
  const isAdmin = computed(() => role.value === 'admin')
  const isClient = computed(() => role.value === 'client')
  const currentUser = computed(() => admin.value || client.value)

  // Actions
  async function loginAdmin(email: string, password: string) {
    isLoading.value = true
    error.value = null

    try {
      const response = await authService.adminLogin({ email, password })

      // Save token and role
      token.value = response.token
      role.value = 'admin'
      localStorage.setItem('token', response.token)
      localStorage.setItem('role', 'admin')

      // Save admin info
      admin.value = response.user as Admin

      // Redirect to admin dashboard
      router.push('/admin')
    } catch (e: any) {
      error.value = e.response?.data?.error?.message || 'Erreur de connexion'
      throw e
    } finally {
      isLoading.value = false
    }
  }

  async function loginClient(email: string, password: string, siteId: string) {
    isLoading.value = true
    error.value = null

    try {
      const response = await authService.clientLogin({ email, password, siteId })

      // Save token and role
      token.value = response.token
      role.value = 'client'
      localStorage.setItem('token', response.token)
      localStorage.setItem('role', 'client')

      // Save client info
      client.value = response.user as ClientUser

      // Redirect to client dashboard
      router.push('/dashboard')
    } catch (e: any) {
      error.value = e.response?.data?.error?.message || 'Erreur de connexion'
      throw e
    } finally {
      isLoading.value = false
    }
  }

  async function checkAuth() {
    if (!token.value) return false

    try {
      const user = await authService.getMe()
      role.value = user.role
      localStorage.setItem('role', user.role)

      if (user.role === 'admin') {
        admin.value = user as unknown as Admin
      } else if (user.role === 'client') {
        client.value = user as unknown as ClientUser
      }
      return true
    } catch {
      logout()
      return false
    }
  }

  function logout() {
    token.value = null
    role.value = null
    admin.value = null
    client.value = null
    localStorage.removeItem('token')
    localStorage.removeItem('role')

    // Redirect based on previous role
    router.push('/login')
  }

  // Listen for unauthorized events
  window.addEventListener('auth:unauthorized', () => {
    logout()
  })

  return {
    // State
    token,
    role,
    admin,
    client,
    isLoading,
    error,
    // Getters
    isAuthenticated,
    isAdmin,
    isClient,
    currentUser,
    // Actions
    loginAdmin,
    loginClient,
    checkAuth,
    logout,
  }
})
