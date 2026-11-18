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
  <div class="cadre">
    <aside class="barre glass-card">
      <RouterLink to="/admin" class="marque">
        <span class="bf-logo" aria-hidden="true">ᛒ</span>
        <span>
          <strong>Bifrost</strong>
          <small>Espace développeur</small>
        </span>
      </RouterLink>

      <nav aria-label="Navigation">
        <RouterLink v-for="item in navItems" :key="item.path" :to="item.path" class="onglet" :class="{ actif: isActive(item.path) }">
          {{ item.name }}
        </RouterLink>
      </nav>

      <div class="moi">
        <span class="adresse" :title="auth.admin?.email">{{ auth.admin?.email }}</span>
        <div class="boutons">
          <button type="button" class="glass-button" :title="`Thème : ${ui.theme === 'system' ? 'comme l’appareil' : ui.theme === 'dark' ? 'sombre' : 'clair'}`" @click="ui.basculerTheme()">{{ ui.theme === 'dark' ? '🌙' : ui.theme === 'light' ? '☀️' : '💻' }}</button>
          <button type="button" class="glass-button" title="Déconnexion" @click="auth.logout()"><span class="sortie-texte">Déconnexion</span><span class="sortie-icone" aria-hidden="true">⏻</span></button>
        </div>
      </div>
    </aside>

    <main class="contenu">
      <RouterView />
    </main>
  </div>
</template>

<style scoped>
.cadre { min-height: 100vh; display: grid; grid-template-columns: 248px minmax(0, 1fr); gap: 0; }
.barre { position: sticky; top: 16px; margin: 16px 0 16px 16px; height: calc(100vh - 32px); padding: 18px 14px; display: flex; flex-direction: column; gap: 28px; }
.marque { display: flex; align-items: center; gap: 12px; padding: 0 6px; }
.marque strong { display: block; font-size: 17px; letter-spacing: .01em; }
.marque small { display: block; font-size: 12px; color: var(--bf-doux); }
nav { display: grid; gap: 4px; }
.onglet { padding: 10px 14px; border-radius: 12px; font-weight: 600; font-size: 14px; color: var(--bf-doux); transition: background .15s, color .15s; }
.onglet:hover { background: var(--bf-verre-fort); color: var(--bf-texte); }
.onglet.actif { color: var(--bf-texte); background: linear-gradient(135deg, rgba(139, 92, 246, .35), rgba(224, 122, 74, .25)); box-shadow: inset 0 0 0 1px var(--bf-bord); }
.moi { margin-top: auto; display: grid; gap: 10px; padding: 0 6px; }
.boutons { display: flex; gap: 8px; }
.boutons .glass-button:last-child { flex: 1; }
.sortie-icone { display: none; }
.adresse { font-size: 13px; color: var(--bf-doux); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.contenu { padding: 40px clamp(16px, 4vw, 48px); min-width: 0; }

@media (max-width: 860px) {
  .cadre { grid-template-columns: minmax(0, 1fr); }
  .barre { position: sticky; top: 0; z-index: 20; margin: 0; height: auto; border-radius: 0; flex-direction: row; align-items: center; gap: 12px; padding: 10px 14px; border-width: 0 0 1px; }
  .marque > span:not(.bf-logo), .adresse, .sortie-texte { display: none; }
  .sortie-icone { display: inline; }
  .marque .bf-logo { width: 36px; height: 36px; font-size: 20px; }
  .onglet { padding: 8px 12px; }
  nav { display: flex; gap: 4px; }
  .moi { margin: 0 0 0 auto; padding: 0; }
  .contenu { padding: 24px 16px; }
}
</style>
