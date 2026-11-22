<script setup lang="ts">
/** Compte du dev : adresse, double authentification. */
import DoubleAuth from '@/components/compte/DoubleAuth.vue'
import { doubleAuthDev } from '@/services/auth.service'
import { useAuthStore } from '@/stores/auth.store'

const auth = useAuthStore()

// Une fois activée, le reste de l'espace dev s'ouvre (le serveur a donné une session complète)
const api = {
  ...doubleAuthDev,
  activer: async (code: string) => {
    const r = await doubleAuthDev.activer(code)
    if (auth.admin) auth.admin.doubleAuthAActiver = false
    return r
  },
}
</script>

<template>
  <div class="compte">
    <span class="surtitre">Espace développeur</span>
    <h1>Mon compte</h1>
    <p class="chapeau">{{ auth.admin?.email }}</p>
    <p v-if="auth.admin?.doubleAuthAActiver" class="obligatoire">Le compte dev ouvre tous les sites de vos clients : la double authentification est obligatoire. Activez-la pour continuer.</p>
    <section class="glass-card bloc">
      <DoubleAuth :api="api" :compte="auth.admin?.email" />
    </section>
    <p class="note">Si un client perd son téléphone et ses codes de secours, retirez sa double authentification depuis la fiche de son site, carte « Équipe ».</p>
  </div>
</template>

<style scoped>
.compte { max-width: 640px; display: grid; gap: 8px; }
.bloc { margin-top: 24px; padding: 20px; box-shadow: none; }
.obligatoire { margin-top: 16px; padding: 12px 14px; border-radius: 12px; background: rgba(245, 158, 11, 0.12); border: 1px solid rgba(245, 158, 11, 0.35); font-size: 14px; }
.note { margin-top: 12px; font-size: 13px; color: var(--bf-doux); }
</style>
