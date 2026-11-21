<script setup lang="ts">
/**
 * Connexion des clients : e-mail et mot de passe, sans identifiant de site.
 * Arrivée sur l'espace client (tous ses sites), ou sur l'éditeur si un lien visait un site.
 */
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth.store'
import { comptesService, codeDemande, type Session } from '@/services/comptes.service'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

const mode = ref<'connexion' | 'oubli' | 'oubli-envoye'>('connexion')
const email = ref((route.query.email as string) || '')
const motDePasse = ref('')
// Double authentification : le champ apparaît quand le serveur le demande
const code = ref('')
const avecCode = ref(false)
const info = ref(route.query.info === 'mot-de-passe' ? 'Mot de passe enregistré. Connectez-vous avec votre code d’authentification.' : '')
const erreur = ref('')
const occupe = ref(false)

/** Le lien visait un site de la personne : on l'ouvre dans l'éditeur. Sinon, son espace. */
function entrer(r: Session) {
  auth.ouvrirSession(r, false)
  const voulu = route.query.site as string | undefined
  router.push(voulu && (voulu === r.user.siteId || voulu === r.user.site.slug) ? `/edition/${r.user.site.slug || r.user.siteId}` : '/espace')
}

async function seConnecter() {
  erreur.value = ''
  occupe.value = true
  try {
    entrer(await comptesService.connexion(email.value, motDePasse.value, (route.query.site as string) || undefined, code.value))
  } catch (e: any) {
    if (codeDemande(e)) {
      avecCode.value = true
      erreur.value = ''
      setTimeout(() => document.getElementById('code')?.focus(), 50)
      return
    }
    // un ?site= ancien ne doit pas bloquer : on réessaie sans
    if (route.query.site && e?.response?.status === 401) {
      try {
        auth.ouvrirSession(await comptesService.connexion(email.value, motDePasse.value, undefined, code.value), false)
        router.push('/espace')
        return
      } catch { /* même message ci-dessous */ }
    }
    erreur.value = e?.response?.data?.error?.message || 'E-mail ou mot de passe incorrect'
  } finally {
    occupe.value = false
  }
}

async function demanderLien() {
  erreur.value = ''
  occupe.value = true
  try {
    await comptesService.oubli(email.value)
    mode.value = 'oubli-envoye'
  } catch (e: any) {
    erreur.value = e?.response?.data?.error?.message || 'Impossible d’envoyer le lien pour l’instant.'
  } finally {
    occupe.value = false
  }
}
</script>

<template>
  <div class="min-h-screen flex items-center justify-center p-4 sm:p-8">
    <div class="glass-card p-6 sm:p-8 max-w-md w-full">
      <div class="text-center mb-8">
        <div class="bf-logo bf-logo--grand mx-auto mb-5" aria-hidden="true">ᛒ</div>
        <h1 class="text-3xl font-bold mb-2">{{ mode === 'connexion' ? 'Modifier mon site' : 'Mot de passe oublié' }}</h1>
        <p class="text-gray-600 dark:text-gray-300">
          {{ mode === 'connexion' ? 'Connectez-vous pour modifier votre site.' : 'Recevez un lien pour choisir un nouveau mot de passe.' }}
        </p>
      </div>

      <form v-if="mode === 'connexion'" class="space-y-6" @submit.prevent="seConnecter()">
        <div>
          <label for="email" class="block text-sm font-medium mb-2">E-mail</label>
          <input id="email" v-model="email" type="email" required autocomplete="email" class="input-field" placeholder="vous@exemple.com">
        </div>
        <div>
          <label for="mdp" class="block text-sm font-medium mb-2">Mot de passe</label>
          <input id="mdp" v-model="motDePasse" type="password" required autocomplete="current-password" class="input-field">
        </div>
        <div v-if="avecCode">
          <label for="code" class="block text-sm font-medium mb-2">Code de vérification</label>
          <input id="code" v-model="code" required inputmode="numeric" autocomplete="one-time-code" maxlength="20" class="input-field code" placeholder="123 456">
          <p class="text-xs text-gray-500 mt-2">Le code à 6 chiffres de votre appli d’authentification, ou un code de secours.</p>
        </div>
        <div v-if="info && !erreur" class="text-green-600 text-sm text-center" role="status">{{ info }}</div>
        <div v-if="erreur" class="text-red-500 text-sm text-center" role="alert">{{ erreur }}</div>
        <button type="submit" :disabled="occupe" class="btn-primary w-full">{{ occupe ? 'Connexion…' : 'Se connecter' }}</button>
        <button type="button" class="block mx-auto text-sm text-blue-500 hover:underline" @click="mode = 'oubli'; erreur = ''">Mot de passe oublié ?</button>
      </form>

      <form v-else-if="mode === 'oubli'" class="space-y-6" @submit.prevent="demanderLien">
        <div>
          <label for="email2" class="block text-sm font-medium mb-2">E-mail</label>
          <input id="email2" v-model="email" type="email" required autocomplete="email" class="input-field" placeholder="vous@exemple.com">
        </div>
        <div v-if="erreur" class="text-red-500 text-sm text-center" role="alert">{{ erreur }}</div>
        <button type="submit" :disabled="occupe" class="btn-primary w-full">Recevoir le lien</button>
        <button type="button" class="block mx-auto text-sm text-blue-500 hover:underline" @click="mode = 'connexion'">Retour</button>
      </form>

      <div v-else class="space-y-6 text-center">
        <p>Si un compte existe pour <strong>{{ email }}</strong>, un e-mail vient de partir avec un lien valable une heure.</p>
        <button type="button" class="text-sm text-blue-500 hover:underline" @click="mode = 'connexion'">Retour à la connexion</button>
      </div>

      <div class="mt-8 text-center">
        <router-link to="/admin/login" class="text-gray-500 hover:underline text-xs">Espace développeur</router-link>
      </div>
    </div>
  </div>
</template>

<style scoped>
.code { font-size: 20px; letter-spacing: .2em; text-align: center; font-variant-numeric: tabular-nums; }
</style>

