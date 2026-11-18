<script setup lang="ts">
import { RouterView, RouterLink, useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth.store'
import { useUIStore } from '@/stores/ui.store'

const auth = useAuthStore()
const ui = useUIStore()
const route = useRoute()

const navItems = [
  { name: 'Sites', path: '/admin' },
  { name: 'Activité', path: '/admin/activite' },
]

const isActive = (path: string) =>
  path === '/admin' ? route.path === '/admin' || route.path.startsWith('/admin/sites') : route.path.startsWith(path)
</script>

<template>
  <header class="entete">
    <div class="barre glass-card">
      <RouterLink to="/admin" class="marque">
        <span class="bf-rune logo" aria-hidden="true">ᛒ</span>
        <span>Bifrost</span>
      </RouterLink>

      <nav class="liens" aria-label="Navigation">
        <RouterLink v-for="item in navItems" :key="item.path" :to="item.path" class="lien" :class="{ actif: isActive(item.path) }">
          {{ item.name }}
        </RouterLink>
      </nav>

      <div class="moi">
        <span class="adresse" :title="auth.admin?.email">{{ auth.admin?.email }}</span>
        <button type="button" class="lien icone" :title="`Thème : ${ui.theme === 'system' ? 'comme l’appareil' : ui.theme === 'dark' ? 'sombre' : 'clair'}`" @click="ui.basculerTheme()">{{ ui.theme === 'dark' ? '🌙' : ui.theme === 'light' ? '☀️' : '💻' }}</button>
        <button type="button" class="lien" title="Déconnexion" @click="auth.logout()"><span class="sortie-texte">Déconnexion</span><span class="sortie-icone" aria-hidden="true">⏻</span></button>
      </div>
    </div>
  </header>

  <main class="contenu">
    <RouterView />
  </main>
</template>

<style scoped>
/* Barre en pilule, collée en haut, comme sur ragnardrock.fr */
.entete { position: sticky; top: 0; z-index: 20; padding: 14px clamp(16px, 4vw, 48px); }
.barre {
  max-width: 1200px; margin: 0 auto; display: flex; align-items: center; gap: 16px;
  padding: 8px 10px 8px 18px; border-radius: 999px; background: var(--bf-barre); box-shadow: none;
}
.marque { display: flex; align-items: baseline; gap: 10px; color: var(--bf-fort); font-weight: 650; text-decoration: none; }
.logo { font-size: 1.25rem; }
.liens { display: flex; align-items: center; gap: 2px; }
.lien {
  display: inline-flex; align-items: center; padding: 7px 14px; border-radius: 999px;
  color: var(--bf-texte); font: inherit; font-size: .93rem; font-weight: 500; text-decoration: none;
  background: none; border: 0; cursor: pointer; transition: background .2s, color .2s; white-space: nowrap;
}
.lien:hover, .lien.actif { background: var(--bf-verre-fort); color: var(--bf-fort); }
.lien.icone { padding: 7px 10px; }
.moi { margin-left: auto; display: flex; align-items: center; gap: 2px; min-width: 0; }
.adresse { font-size: 13px; color: var(--bf-doux); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; margin-right: 6px; }
.sortie-icone { display: none; }
.contenu { max-width: 1200px; margin: 0 auto; padding: 32px clamp(16px, 4vw, 48px) 80px; min-width: 0; }
@media (max-width: 860px) {
  .adresse, .sortie-texte { display: none; }
  .sortie-icone { display: inline; }
  .barre { gap: 6px; padding-left: 14px; }
  .lien { padding: 7px 10px; }
  .contenu { padding: 20px 16px 60px; }
}
</style>
