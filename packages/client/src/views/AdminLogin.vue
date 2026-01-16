<script setup lang="ts">
import { ref } from 'vue'
import { useAuthStore } from '@/stores/auth.store'

const auth = useAuthStore()

const email = ref('')
const password = ref('')

async function handleLogin() {
  try {
    await auth.loginAdmin(email.value, password.value)
    // Redirect handled by the store
  } catch {
    // Error handled by the store
  }
}
</script>

<template>
  <div class="min-h-screen flex items-center justify-center p-8">
    <div class="glass-card p-8 max-w-md w-full">
      <div class="text-center mb-8">
        <h1 class="text-3xl font-bold mb-2">Admin Bifrost</h1>
        <p class="text-gray-600 dark:text-gray-300">Espace administrateur</p>
      </div>

      <form @submit.prevent="handleLogin" class="space-y-6">
        <div>
          <label for="email" class="block text-sm font-medium mb-2">Email</label>
          <input
            id="email"
            v-model="email"
            type="email"
            required
            autocomplete="email"
            class="input-field"
            placeholder="admin@bifrost.local"
          />
        </div>

        <div>
          <label for="password" class="block text-sm font-medium mb-2">Mot de passe</label>
          <input
            id="password"
            v-model="password"
            type="password"
            required
            autocomplete="current-password"
            class="input-field"
            placeholder="••••••••"
          />
        </div>

        <div v-if="auth.error" class="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
          <p class="text-red-500 text-sm text-center">
            {{ auth.error }}
          </p>
        </div>

        <button
          type="submit"
          :disabled="auth.isLoading"
          class="btn-primary w-full flex items-center justify-center gap-2"
        >
          <span v-if="auth.isLoading" class="animate-spin">⏳</span>
          {{ auth.isLoading ? 'Connexion...' : 'Se connecter' }}
        </button>
      </form>

      <div class="mt-6 text-center">
        <router-link to="/" class="text-blue-500 hover:underline text-sm">
          Retour à l'accueil
        </router-link>
      </div>
    </div>
  </div>
</template>
