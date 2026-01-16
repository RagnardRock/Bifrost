<script setup lang="ts">
import { useUIStore } from '@/stores/ui.store'

const ui = useUIStore()

function toggleTheme() {
  const themes: Array<'light' | 'dark' | 'system'> = ['light', 'dark', 'system']
  const currentIndex = themes.indexOf(ui.theme)
  const nextIndex = (currentIndex + 1) % themes.length
  ui.setTheme(themes[nextIndex])
}
</script>

<template>
  <div class="min-h-screen flex items-center justify-center p-8">
    <div class="glass-card p-8 max-w-md w-full text-center">
      <h1 class="text-4xl font-bold mb-4">Bifrost</h1>
      <p class="text-lg text-gray-600 dark:text-gray-300 mb-8">
        Site-First Headless CMS
      </p>

      <div class="space-y-4">
        <router-link to="/login" class="btn-primary block w-full text-center">
          Client Login
        </router-link>

        <router-link to="/admin/login" class="glass-button block w-full text-center">
          Admin Login
        </router-link>

        <button @click="toggleTheme" class="glass-button w-full">
          Theme: {{ ui.theme }}
        </button>
      </div>
    </div>
  </div>
</template>
