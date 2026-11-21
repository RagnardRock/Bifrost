<script setup lang="ts">
/** Compte du dev : adresse, double authentification. */
import DoubleAuth from '@/components/compte/DoubleAuth.vue'
import { doubleAuthDev } from '@/services/auth.service'
import { useAuthStore } from '@/stores/auth.store'

const auth = useAuthStore()
</script>

<template>
  <div class="compte">
    <span class="surtitre">Espace développeur</span>
    <h1>Mon compte</h1>
    <p class="chapeau">{{ auth.admin?.email }}</p>
    <section class="glass-card bloc">
      <DoubleAuth :api="doubleAuthDev" :compte="auth.admin?.email" />
    </section>
    <p class="note">Si un client perd son téléphone et ses codes de secours, retirez sa double authentification depuis la fiche de son site, carte « Équipe ».</p>
  </div>
</template>

<style scoped>
.compte { max-width: 640px; display: grid; gap: 8px; }
.bloc { margin-top: 24px; padding: 20px; box-shadow: none; }
.note { margin-top: 12px; font-size: 13px; color: var(--bf-doux); }
</style>
