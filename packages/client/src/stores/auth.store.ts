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

function lireRole(): 'admin' | 'client' | null {
  try {
    const r = localStorage.getItem('role')
    return r === 'admin' || r === 'client' ? r : null
  } catch { return null }
}
function ecrireRole(r: 'admin' | 'client' | null) {
  try { if (r) localStorage.setItem('role', r); else localStorage.removeItem('role') } catch { /* stockage indisponible */ }
}

export const useAuthStore = defineStore('auth', () => {
  const router = useRouter()

  // State : la session elle-même est dans un cookie que la page ne lit pas ; on garde seulement le rôle
  const role = ref<'admin' | 'client' | null>(lireRole())
  const admin = ref<Admin | null>(null)
  const client = ref<ClientUser | null>(null)
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  // Getters
  const isAuthenticated = computed(() => !!role.value)
  const isAdmin = computed(() => role.value === 'admin')
  const isClient = computed(() => role.value === 'client')
  const currentUser = computed(() => admin.value || client.value)

  // Actions
  async function loginAdmin(email: string, password: string, code?: string) {
    isLoading.value = true
    error.value = null

    try {
      const response = await authService.adminLogin({ email, password, code: code || undefined })

      role.value = 'admin'
      ecrireRole('admin')
      admin.value = { ...(response.user as Admin), doubleAuthAActiver: !!response.doubleAuthAActiver }

      // Double authentification obligatoire pas encore activée : direction « Mon compte »
      router.push(response.doubleAuthAActiver ? '/admin/compte' : '/admin')
    } catch (e: any) {
      error.value = e.response?.data?.error?.message || 'Erreur de connexion'
      throw e
    } finally {
      isLoading.value = false
    }
  }


  /** Session ouverte par la connexion v2 (e-mail seul) ou par un lien d'invitation / de mot de passe oublié. */
  function ouvrirSession(s: { token: string; user: { id: string; email: string; siteId: string; site: { name: string; slug?: string | null } } }, aller = true) {
    role.value = 'client'
    ecrireRole('client')
    client.value = { id: s.user.id, email: s.user.email, siteId: s.user.siteId, siteName: s.user.site.name, createdAt: new Date(), updatedAt: new Date() }
    if (aller) router.push(`/edition/${s.user.site.slug || s.user.siteId}`)
  }

  async function checkAuth() {
    if (!role.value) return false

    try {
      const user = await authService.getMe()
      role.value = user.role
      ecrireRole(user.role)

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
    const etaitDev = role.value === 'admin' || router.currentRoute.value.path.startsWith('/admin')
    if (role.value) void authService.deconnexion()
    role.value = null
    admin.value = null
    client.value = null
    ecrireRole(null)

    // Le dev revient sur sa page de connexion, le client sur la sienne
    router.push(etaitDev ? '/admin/login' : '/login')
  }

  // Listen for unauthorized events
  window.addEventListener('auth:unauthorized', () => {
    logout()
  })

  return {
    // State
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
    ouvrirSession,
    checkAuth,
    logout,
  }
})
