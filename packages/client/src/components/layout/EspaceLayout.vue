<script setup lang="ts">
/** Espace client : même barre que l'espace développeur (Mes sites, Messages, Mon compte). */
import { onMounted } from 'vue'
import { RouterView, RouterLink, useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth.store'
import { useUIStore } from '@/stores/ui.store'
import { useEspace, oublierEspace } from '@/composables/espace'

const auth = useAuthStore()
const ui = useUIStore()
const route = useRoute()
const { nonLus, responsables, recharger } = useEspace()

const isActive = (path: string) => (path === '/espace' ? route.path === '/espace' || route.path.startsWith('/espace/sites') : route.path.startsWith(path))

function deconnexion() {
  oublierEspace()
  auth.logout()
}

onMounted(() => { if (auth.isClient) void recharger() })
</script>

<template>
  <header class="entete">
    <div class="barre glass-card">
      <RouterLink :to="auth.isAdmin ? '/admin' : '/espace'" class="marque">
        <span class="bf-rune logo" aria-hidden="true">ᛒ</span>
        <span>Bifrost</span>
      </RouterLink>

      <nav v-if="auth.isClient" class="liens" aria-label="Navigation">
        <RouterLink to="/espace" class="lien" :class="{ actif: isActive('/espace') }">Mes sites</RouterLink>
        <RouterLink v-if="responsables.length" to="/espace/messages" class="lien" :class="{ actif: isActive('/espace/messages') }">
          Messages<b v-if="nonLus" class="pastille" :aria-label="`${nonLus} non lu${nonLus > 1 ? 's' : ''}`">{{ nonLus }}</b>
        </RouterLink>
      </nav>
      <nav v-else class="liens" aria-label="Navigation">
        <RouterLink to="/admin" class="lien">← Espace développeur</RouterLink>
      </nav>

      <div class="moi">
        <RouterLink v-if="auth.isClient" to="/espace/compte" class="lien compte" :class="{ actif: route.path === '/espace/compte' }" title="Mon compte : mot de passe, double authentification, notifications">
          <span class="adresse">{{ auth.currentUser?.email }}</span><span class="compte-icone" aria-hidden="true">👤</span>
        </RouterLink>
        <button type="button" class="lien icone" :title="`Thème : ${ui.theme === 'system' ? 'comme l’appareil' : ui.theme === 'dark' ? 'sombre' : 'clair'}`" @click="ui.basculerTheme()">{{ ui.theme === 'dark' ? '🌙' : ui.theme === 'light' ? '☀️' : '💻' }}</button>
        <button v-if="auth.isClient" type="button" class="lien" title="Déconnexion" @click="deconnexion"><span class="sortie-texte">Déconnexion</span><span class="sortie-icone" aria-hidden="true">⏻</span></button>
      </div>
    </div>
  </header>

  <main class="contenu">
    <RouterView />
  </main>
</template>

<style scoped>
.entete { position: sticky; top: 0; z-index: 20; padding: 14px clamp(16px, 4vw, 48px); }
.barre {
  max-width: 1200px; margin: 0 auto; display: flex; align-items: center; gap: 16px;
  padding: 8px 10px 8px 18px; border-radius: 999px; background: var(--bf-barre); box-shadow: none;
}
.marque { display: flex; align-items: baseline; gap: 10px; color: var(--bf-fort); font-weight: 650; text-decoration: none; }
.logo { font-size: 1.25rem; }
.liens { display: flex; align-items: center; gap: 2px; min-width: 0; }
.lien {
  display: inline-flex; align-items: center; gap: 6px; padding: 7px 14px; border-radius: 999px;
  color: var(--bf-texte); font: inherit; font-size: .93rem; font-weight: 500; text-decoration: none;
  background: none; border: 0; cursor: pointer; transition: background .2s, color .2s; white-space: nowrap;
}
.lien:hover, .lien.actif { background: var(--bf-verre-fort); color: var(--bf-fort); }
.lien.icone { padding: 7px 10px; }
.pastille { min-width: 20px; height: 20px; padding: 0 6px; border-radius: 999px; background: var(--bf-accent); color: #fff; font-size: 11px; line-height: 20px; text-align: center; }
.moi { margin-left: auto; display: flex; align-items: center; gap: 2px; min-width: 0; }
.adresse { font-size: 13px; color: var(--bf-doux); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.compte { min-width: 0; }
.compte-icone, .sortie-icone { display: none; }
.contenu { max-width: 1200px; margin: 0 auto; padding: 32px clamp(16px, 4vw, 48px) 80px; min-width: 0; }
@media (max-width: 860px) {
  .adresse, .sortie-texte, .marque span:not(.logo) { display: none; }
  .compte-icone, .sortie-icone { display: inline; }
  .barre { gap: 6px; padding-left: 14px; }
  .lien { padding: 7px 10px; }
  .contenu { padding: 20px 16px 60px; }
}
</style>
