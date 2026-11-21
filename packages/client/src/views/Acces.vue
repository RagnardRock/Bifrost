<script setup lang="ts">
/**
 * Lien reçu par e-mail : invitation dans l'équipe d'un site, ou mot de passe oublié.
 * La personne choisit son mot de passe et arrive directement dans l'éditeur.
 */
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth.store'
import { comptesService } from '@/services/comptes.service'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const jeton = computed(() => route.params.jeton as string)

const info = ref<{ type: 'invitation' | 'reinitialisation'; email: string; site: { nom: string } } | null>(null)
const invalide = ref('')
const motDePasse = ref('')
const confirmation = ref('')
const erreur = ref('')
const occupe = ref(false)

onMounted(async () => {
  try {
    info.value = await comptesService.lireAcces(jeton.value)
  } catch (e: any) {
    invalide.value = e?.response?.data?.error?.message || 'Ce lien n’est plus valable.'
  }
})

async function valider() {
  erreur.value = ''
  if (motDePasse.value.length < 10) { erreur.value = 'Le mot de passe doit faire au moins 10 caractères.'; return }
  if (motDePasse.value !== confirmation.value) { erreur.value = 'Les deux mots de passe ne sont pas identiques.'; return }
  occupe.value = true
  try {
    const r = await comptesService.utiliserAcces(jeton.value, motDePasse.value)
    // Compte protégé par la double authentification : connexion avec le code
    if ('connexion' in r) router.push({ name: 'login', query: { email: r.email, info: 'mot-de-passe' } })
    else auth.ouvrirSession(r)
  } catch (e: any) {
    erreur.value = e?.response?.data?.error?.message || 'Impossible d’enregistrer le mot de passe.'
  } finally {
    occupe.value = false
  }
}
</script>

<template>
  <div class="min-h-screen flex items-center justify-center p-4 sm:p-8">
    <div class="glass-card p-6 sm:p-8 max-w-md w-full">
      <div class="bf-logo bf-logo--grand mx-auto mb-5" aria-hidden="true">ᛒ</div>

      <div v-if="invalide" class="text-center space-y-4">
        <h1 class="text-2xl font-bold">Lien expiré</h1>
        <p>{{ invalide }}</p>
        <router-link to="/login" class="btn-primary inline-block">Aller à la connexion</router-link>
      </div>

      <form v-else-if="info" class="space-y-6" @submit.prevent="valider">
        <div class="text-center">
          <h1 class="text-2xl font-bold mb-2">{{ info.type === 'invitation' ? 'Bienvenue !' : 'Nouveau mot de passe' }}</h1>
          <p class="text-gray-600 dark:text-gray-300">
            <template v-if="info.type === 'invitation'">Vous allez pouvoir modifier le site <strong>{{ info.site.nom }}</strong>. Choisissez votre mot de passe.</template>
            <template v-else>Choisissez un nouveau mot de passe pour <strong>{{ info.site.nom }}</strong>.</template>
          </p>
        </div>
        <div>
          <label class="block text-sm font-medium mb-2" for="email">E-mail</label>
          <input id="email" :value="info.email" type="email" class="input-field" disabled autocomplete="username">
        </div>
        <div>
          <label class="block text-sm font-medium mb-2" for="mdp">Mot de passe (10 caractères minimum)</label>
          <input id="mdp" v-model="motDePasse" type="password" required minlength="10" autocomplete="new-password" class="input-field">
        </div>
        <div>
          <label class="block text-sm font-medium mb-2" for="mdp2">Le même, une seconde fois</label>
          <input id="mdp2" v-model="confirmation" type="password" required autocomplete="new-password" class="input-field">
        </div>
        <div v-if="erreur" class="text-red-500 text-sm text-center" role="alert">{{ erreur }}</div>
        <button type="submit" class="btn-primary w-full" :disabled="occupe">{{ info.type === 'invitation' ? 'Commencer' : 'Enregistrer' }}</button>
      </form>

      <p v-else class="text-center">Un instant…</p>
    </div>
  </div>
</template>

