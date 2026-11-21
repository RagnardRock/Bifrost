<script setup lang="ts">
import { ref } from 'vue'
import { useAuthStore } from '@/stores/auth.store'
import { codeDemande } from '@/services/comptes.service'

const auth = useAuthStore()

const email = ref('')
const password = ref('')
// Double authentification : le champ apparaît quand le serveur le demande
const code = ref('')
const avecCode = ref(false)

async function handleLogin() {
  try {
    await auth.loginAdmin(email.value, password.value, code.value)
    // Redirect handled by the store
  } catch (e) {
    if (codeDemande(e)) {
      avecCode.value = true
      auth.error = null
      setTimeout(() => document.getElementById('code')?.focus(), 50)
    }
    // Other errors handled by the store
  }
}
</script>

<template>
  <div class="min-h-screen flex items-center justify-center p-4 sm:p-8">
    <div class="glass-card p-6 sm:p-8 max-w-md w-full">
      <div class="text-center mb-8">
        <div class="bf-logo bf-logo--grand mx-auto mb-5" aria-hidden="true">ᛒ</div>
        <h1 class="text-3xl font-bold mb-2">Espace développeur</h1>
        <p class="text-gray-600">Vos sites, vos clients, ce qui s'y passe.</p>
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
            autocomplete="current-password"
            class="input-field"
            placeholder="••••••••"
          />
        </div>

        <div v-if="avecCode">
          <label for="code" class="block text-sm font-medium mb-2">Code de vérification</label>
          <input id="code" v-model="code" required inputmode="numeric" autocomplete="one-time-code" maxlength="20" class="input-field code" placeholder="123 456">
          <p class="text-xs text-gray-500 mt-2">Le code à 6 chiffres de votre appli d’authentification, ou un code de secours.</p>
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
        <router-link to="/login" class="text-blue-500 hover:underline text-sm">
          Espace client
        </router-link>
      </div>
    </div>
  </div>
</template>

<style scoped>
.code { font-size: 20px; letter-spacing: .2em; text-align: center; font-variant-numeric: tabular-nums; }
</style>
