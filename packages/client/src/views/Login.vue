<script setup lang="ts">
import { ref } from 'vue'
import { useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth.store'

const route = useRoute()
const authStore = useAuthStore()

// Get siteId from query params (e.g., /login?site=xxx)
const siteId = ref((route.query.site as string) || '')
const email = ref('')
const password = ref('')
const error = ref('')

async function handleLogin() {
  error.value = ''

  if (!siteId.value) {
    error.value = 'Identifiant du site requis'
    return
  }

  try {
    await authStore.loginClient(email.value, password.value, siteId.value)
  } catch {
    error.value = authStore.error || 'Email ou mot de passe incorrect'
  }
}
</script>

<template>
  <div class="min-h-screen flex items-center justify-center p-8">
    <div class="glass-card p-8 max-w-md w-full">
      <div class="text-center mb-8">
        <h1 class="text-3xl font-bold mb-2">Connexion Client</h1>
        <p class="text-gray-600 dark:text-gray-300">Accédez à votre espace de gestion</p>
      </div>

      <form @submit.prevent="handleLogin" class="space-y-6">
        <div>
          <label for="siteId" class="block text-sm font-medium mb-2">Identifiant du site</label>
          <input
            id="siteId"
            v-model="siteId"
            type="text"
            required
            class="input-field"
            placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
          />
        </div>

        <div>
          <label for="email" class="block text-sm font-medium mb-2">Email</label>
          <input
            id="email"
            v-model="email"
            type="email"
            required
            class="input-field"
            placeholder="vous@exemple.com"
          />
        </div>

        <div>
          <label for="password" class="block text-sm font-medium mb-2">Mot de passe</label>
          <input
            id="password"
            v-model="password"
            type="password"
            required
            class="input-field"
            placeholder="••••••••"
          />
        </div>

        <div v-if="error" class="text-red-500 text-sm text-center">
          {{ error }}
        </div>

        <button type="submit" :disabled="authStore.isLoading" class="btn-primary w-full">
          {{ authStore.isLoading ? 'Connexion...' : 'Se connecter' }}
        </button>
      </form>

      <div class="mt-6 text-center space-y-2">
        <router-link to="/admin/login" class="block text-blue-500 hover:underline text-sm">
          Connexion administrateur
        </router-link>
        <router-link to="/" class="block text-gray-500 hover:underline text-sm">
          Retour à l'accueil
        </router-link>
      </div>
    </div>
  </div>
</template>
