import axios, { type AxiosError } from 'axios'
import type { ApiErrorResponse } from '@bifrost/shared'

// La session est dans un cookie que la page ne peut pas lire (posé par le serveur à la connexion).
// L'en-tête X-Bifrost prouve au serveur que la demande vient bien de l'interface.
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  timeout: 10000,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
    'X-Bifrost': '1',
  },
})

// Ancienne session gardée par le navigateur : envoyée une dernière fois, le serveur la passe dans le cookie
const ancienJeton = (() => { try { return localStorage.getItem('token') } catch { return null } })()
api.interceptors.request.use((config) => {
  if (ancienJeton && localStorage.getItem('token')) config.headers.Authorization = `Bearer ${ancienJeton}`
  return config
})

// Response interceptor - handle errors
api.interceptors.response.use(
  (response) => {
    if (ancienJeton) { try { localStorage.removeItem('token') } catch { /* stockage indisponible */ } }
    return response.data // Unwrap to get { success, data }
  },
  (error: AxiosError<ApiErrorResponse>) => {
    // Handle 401 - redirect to login
    // (sauf pour une tentative de connexion : l'erreur s'affiche alors sur le formulaire)
    const connexion = /\/(auth\/admin\/login|comptes\/)/.test(error.config?.url || '')
    if (error.response?.status === 401 && !connexion) {
      localStorage.removeItem('token')
      // Will be handled by auth store
      window.dispatchEvent(new CustomEvent('auth:unauthorized'))
    }

    return Promise.reject(error)
  }
)

export { api }
