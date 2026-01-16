import { defineStore } from 'pinia'
import { ref } from 'vue'

export interface Toast {
  id: number
  type: 'success' | 'error' | 'info' | 'warning'
  message: string
  duration: number
}

let toastId = 0

export const useToastStore = defineStore('toast', () => {
  const toasts = ref<Toast[]>([])

  function add(type: Toast['type'], message: string, duration = 4000) {
    const id = ++toastId
    const toast: Toast = { id, type, message, duration }
    toasts.value.push(toast)

    if (duration > 0) {
      setTimeout(() => {
        remove(id)
      }, duration)
    }

    return id
  }

  function remove(id: number) {
    const index = toasts.value.findIndex((t) => t.id === id)
    if (index !== -1) {
      toasts.value.splice(index, 1)
    }
  }

  function success(message: string, duration?: number) {
    return add('success', message, duration)
  }

  function error(message: string, duration?: number) {
    return add('error', message, duration)
  }

  function info(message: string, duration?: number) {
    return add('info', message, duration)
  }

  function warning(message: string, duration?: number) {
    return add('warning', message, duration)
  }

  return {
    toasts,
    add,
    remove,
    success,
    error,
    info,
    warning,
  }
})
