<script setup lang="ts">
import { RouterView, RouterLink, useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth.store'
import { useUIStore } from '@/stores/ui.store'

const auth = useAuthStore()
const ui = useUIStore()
const route = useRoute()

const navItems = [
  { name: 'Tableau de bord', path: '/dashboard', icon: 'home' },
  { name: 'Contenu', path: '/dashboard/content', icon: 'edit' },
]

const isActive = (path: string) => {
  if (path === '/dashboard') {
    return route.path === '/dashboard'
  }
  return route.path.startsWith(path)
}

function toggleTheme() {
  const themes: Array<'light' | 'dark' | 'system'> = ['light', 'dark', 'system']
  const currentIndex = themes.indexOf(ui.theme)
  const nextIndex = (currentIndex + 1) % themes.length
  ui.setTheme(themes[nextIndex])
}
</script>

<template>
  <div class="min-h-screen flex">
    <!-- Sidebar -->
    <aside class="w-64 glass-card rounded-none border-r border-white/10 flex flex-col">
      <!-- Logo -->
      <div class="p-6 border-b border-white/10">
        <h1 class="text-2xl font-bold">Bifrost</h1>
        <p class="text-sm text-gray-500 dark:text-gray-400">
          {{ auth.client?.siteName || 'Espace Client' }}
        </p>
      </div>

      <!-- Navigation -->
      <nav class="flex-1 p-4">
        <ul class="space-y-2">
          <li v-for="item in navItems" :key="item.path">
            <RouterLink
              :to="item.path"
              :class="[
                'block px-4 py-2 rounded-lg transition-colors',
                isActive(item.path)
                  ? 'bg-blue-600 text-white'
                  : 'hover:bg-white/10 dark:hover:bg-gray-800/40'
              ]"
            >
              {{ item.name }}
            </RouterLink>
          </li>
        </ul>
      </nav>

      <!-- User section -->
      <div class="p-4 border-t border-white/10">
        <div class="flex items-center justify-between mb-4">
          <div class="text-sm truncate">
            {{ auth.client?.email }}
          </div>
        </div>
        <div class="flex gap-2">
          <button @click="toggleTheme" class="glass-button flex-1 text-sm">
            {{ ui.theme === 'dark' ? 'Clair' : ui.theme === 'light' ? 'Sombre' : 'Auto' }}
          </button>
          <button @click="auth.logout()" class="glass-button flex-1 text-sm text-red-500">
            Deconnexion
          </button>
        </div>
      </div>
    </aside>

    <!-- Main content -->
    <main class="flex-1 p-8 overflow-auto">
      <RouterView />
    </main>
  </div>
</template>
