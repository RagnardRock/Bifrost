import { defineStore } from 'pinia'
import { ref } from 'vue'

type Theme = 'light' | 'dark' | 'system'

export const useUIStore = defineStore('ui', () => {
  const theme = ref<Theme>((localStorage.getItem('theme') as Theme) || 'system')
  const sidebarOpen = ref(true)

  function setTheme(newTheme: Theme) {
    theme.value = newTheme
    localStorage.setItem('theme', newTheme)
    applyTheme()
  }

  function applyTheme() {
    const isDark =
      theme.value === 'dark' ||
      (theme.value === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)

    document.documentElement.classList.toggle('dark', isDark)
  }

  function initTheme() {
    applyTheme()
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme)
  }

  function toggleSidebar() {
    sidebarOpen.value = !sidebarOpen.value
  }

  return {
    theme,
    sidebarOpen,
    setTheme,
    initTheme,
    toggleSidebar,
  }
})
