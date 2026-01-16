import axios, { type AxiosError } from 'axios'
import type { ApiErrorResponse } from '@bifrost/shared'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Request interceptor - add auth token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Response interceptor - handle errors
api.interceptors.response.use(
  (response) => response.data, // Unwrap to get { success, data }
  (error: AxiosError<ApiErrorResponse>) => {
    // Handle 401 - redirect to login
    if (error.response?.status === 401) {
      localStorage.removeItem('token')
      // Will be handled by auth store
      window.dispatchEvent(new CustomEvent('auth:unauthorized'))
    }

    return Promise.reject(error)
  }
)

export { api }
