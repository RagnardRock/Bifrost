<script setup lang="ts">
/** Mon compte (espace client) : connexion, appli sur le téléphone, notifications, mot de passe, double authentification. */
import { onMounted, ref } from 'vue'
import { comptesService } from '@/services/comptes.service'
import DoubleAuth from '@/components/compte/DoubleAuth.vue'
import InstallerAppli from '@/components/appli/InstallerAppli.vue'
import NotificationsAppli from '@/components/appli/NotificationsAppli.vue'
import { useAuthStore } from '@/stores/auth.store'
import { useEspace, oublierEspace } from '@/composables/espace'

const auth = useAuthStore()
const { responsables, recharger } = useEspace()
const erreur = ref('')
const info = ref('')

const mdp = ref({ actuel: '', nouveau: '', confirmation: '' })
async function changerMotDePasse() {
  erreur.value = ''
  info.value = ''
  if (mdp.value.nouveau !== mdp.value.confirmation) { erreur.value = 'Les deux nouveaux mots de passe ne sont pas identiques.'; return }
  try {
    await comptesService.changerMotDePasse(mdp.value.actuel, mdp.value.nouveau)
    mdp.value = { actuel: '', nouveau: '', confirmation: '' }
    info.value = 'Mot de passe changé.'
  } catch (e) { erreur.value = (e as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message || 'Mot de passe non changé.' }
}
function deconnexion() {
  oublierEspace()
  auth.logout()
}

onMounted(() => void recharger())
</script>

<template>
  <section class="ec">
    <h1>Mon compte</h1>
    <div class="ec-grille">
      <div class="ec-pile">
        <div class="ec-carte">
          <h2>Connecté avec</h2>
          <p>{{ auth.currentUser?.email }}</p>
          <button type="button" class="ec-btn ec-debut" @click="deconnexion">Se déconnecter</button>
        </div>
        <div class="ec-carte">
          <h2>Appli sur le téléphone</h2>
          <InstallerAppli />
          <p class="ec-aide">Bifrost s’installe depuis le navigateur, sans passer par un store. L’appli s’ouvre directement sur le dernier site modifié.</p>
        </div>
        <div v-if="responsables.length" class="ec-carte">
          <h2>Notifications</h2>
          <NotificationsAppli />
        </div>
      </div>
      <div class="ec-pile">
        <form class="ec-carte" @submit.prevent="changerMotDePasse">
          <h2>Changer mon mot de passe</h2>
          <label>Mot de passe actuel<input v-model="mdp.actuel" type="password" class="ec-champ" autocomplete="current-password" required></label>
          <label>Nouveau mot de passe<input v-model="mdp.nouveau" type="password" class="ec-champ" autocomplete="new-password" minlength="10" required>
            <span class="ec-aide">10 caractères au moins. Une phrase facile à retenir fait un bon mot de passe.</span>
          </label>
          <label>Nouveau mot de passe, encore une fois<input v-model="mdp.confirmation" type="password" class="ec-champ" autocomplete="new-password" minlength="10" required></label>
          <p v-if="erreur" class="ec-erreur" role="alert">{{ erreur }}</p>
          <p v-if="info" class="ec-ok" role="status">{{ info }}</p>
          <button type="submit" class="ec-btn ec-btn--fort ec-debut">Changer le mot de passe</button>
        </form>
        <div class="ec-carte">
          <DoubleAuth :api="comptesService.doubleAuth" :compte="auth.currentUser?.email" />
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.ec { display: grid; gap: 20px; }
h1 { margin: 0; font-size: 28px; font-weight: 700; letter-spacing: -.01em; }
h2 { margin: 0; font-size: 16px; font-weight: 700; }
.ec-grille { display: grid; gap: 16px; grid-template-columns: repeat(auto-fit, minmax(min(100%, 380px), 1fr)); align-items: start; }
.ec-pile { display: grid; gap: 16px; }
.ec-carte { display: grid; gap: 14px; padding: 20px; border-radius: 16px; background: var(--bf-verre); border: 1px solid var(--bf-bord); }
.ec-carte p { margin: 0; }
.ec-carte label { display: grid; gap: 6px; font-size: 14px; font-weight: 600; }
.ec-champ { min-height: 44px; padding: 10px 12px; border-radius: 10px; border: 1px solid var(--bf-bord-fort); background: var(--bf-champ); color: var(--bf-texte); font: inherit; font-weight: 400; }
.ec-aide { font-size: 13px; font-weight: 400; color: var(--bf-doux); }
.ec-erreur { font-size: 14px; color: var(--bf-danger); }
.ec-ok { font-size: 14px; color: #16a34a; }
.ec-debut { justify-self: start; }
.ec-btn { display: inline-flex; align-items: center; justify-content: center; min-height: 44px; padding: 0 18px; border: 0; border-radius: 999px; background: var(--bf-verre-fort); box-shadow: inset 0 0 0 1px var(--bf-bord); color: var(--bf-texte); font: inherit; font-size: 14px; font-weight: 600; cursor: pointer; white-space: nowrap; }
.ec-btn:hover { background: var(--bf-survol); }
.ec-btn--fort { background: var(--bf-degrade); color: #fff; box-shadow: none; }
</style>
