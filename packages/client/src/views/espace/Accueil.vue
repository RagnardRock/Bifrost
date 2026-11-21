<script setup lang="ts">
/** Accueil de l'espace client : une carte par site, avec ce qui attend (messages, modifications à publier). */
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { useEspace, type SiteEspace } from '@/composables/espace'
import { adresseSite } from '@/services/suivi.service'

const { sites, erreur, recharger } = useEspace()
const cle = (s: SiteEspace) => s.slug || s.id
const pluriel = (n: number, mot: string) => `${n} ${mot}${n > 1 ? 's' : ''}`

// Aperçu : la page d'accueil du site, réduite à la largeur de la carte
const LARGEUR = 1280
const echelles = ref<Record<string, number>>({})
const observateur = typeof ResizeObserver !== 'undefined'
  ? new ResizeObserver((entrees) => {
    for (const e of entrees) {
      const id = (e.target as HTMLElement).dataset.site
      if (id) echelles.value[id] = e.contentRect.width / LARGEUR
    }
  })
  : null
const suivre = (el: unknown) => { if (el instanceof HTMLElement) observateur?.observe(el) }

onMounted(() => void recharger())
onBeforeUnmount(() => observateur?.disconnect())
</script>

<template>
  <section class="ea">
    <header class="ea-tete">
      <h1>Mes sites</h1>
      <p class="ea-note">« Modifier le site » ouvre la page : touchez un texte ou une photo pour le changer.</p>
    </header>

    <p v-if="erreur" class="ea-alerte" role="alert">{{ erreur }} <button type="button" @click="recharger()">Réessayer</button></p>
    <p v-else-if="!sites" class="ea-vide">Chargement…</p>
    <p v-else-if="!sites.length" class="ea-vide">Vous ne faites partie d’aucune équipe pour l’instant.</p>

    <ul v-else class="ea-grille">
      <li v-for="s in sites" :key="s.id" class="ea-carte">
        <div :ref="suivre" class="ea-apercu" :data-site="s.id" aria-hidden="true">
          <iframe
:src="adresseSite(s)" loading="lazy" sandbox="allow-scripts" tabindex="-1" title=""
            :style="{ width: `${LARGEUR}px`, height: `${LARGEUR * 0.625}px`, transform: `scale(${echelles[s.id] ?? 0.25})` }" />
          <router-link :to="`/edition/${cle(s)}`" class="ea-apercu-lien" tabindex="-1" />
        </div>
        <div class="ea-corps">
          <div class="ea-nom">
            <h2>{{ s.nom }}</h2>
            <a :href="adresseSite(s)" target="_blank" rel="noopener">Voir le site ↗</a>
          </div>
          <div class="ea-etats">
            <router-link v-if="s.role === 'responsable' && s.etat?.messagesNonLus" :to="`/espace/sites/${cle(s)}?onglet=messages`" class="ea-etat ea-etat--message">
              📨 {{ pluriel(s.etat.messagesNonLus, 'message') }} non lu{{ s.etat.messagesNonLus > 1 ? 's' : '' }}
            </router-link>
            <router-link v-if="s.etat?.changements.length" :to="`/edition/${cle(s)}`" class="ea-etat ea-etat--publier">
              ✏️ {{ pluriel(s.etat.changements.length, 'modification') }} à publier
            </router-link>
            <span v-if="s.etat && !s.etat.messagesNonLus && !s.etat.changements.length" class="ea-etat">✓ Tout est en ligne</span>
            <span v-if="s.role === 'redacteur'" class="ea-etat">Rédacteur</span>
          </div>
          <div class="ea-actions">
            <router-link :to="`/edition/${cle(s)}`" class="ea-btn ea-btn--fort">Modifier le site</router-link>
            <router-link v-if="s.role === 'responsable'" :to="`/espace/sites/${cle(s)}`" class="ea-btn" title="Messages, équipe, réglages">Gérer</router-link>
          </div>
        </div>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.ea { display: grid; gap: 20px; }
h1 { margin: 0; font-size: 28px; font-weight: 700; letter-spacing: -.01em; }
h2 { margin: 0; font-size: 18px; font-weight: 700; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ea-tete { display: grid; gap: 6px; }
.ea-note { margin: 0; color: var(--bf-doux); font-size: 14px; }
.ea-vide { padding: 32px; text-align: center; color: var(--bf-doux); border-radius: 16px; background: var(--bf-verre); }
.ea-alerte { margin: 0; padding: 12px 16px; border-radius: 12px; background: rgba(220, 38, 38, .12); color: var(--bf-danger); }
.ea-alerte button { margin-left: 8px; border: 0; background: none; color: inherit; font: inherit; font-weight: 600; text-decoration: underline; cursor: pointer; }
.ea-grille { list-style: none; margin: 0; padding: 0; display: grid; gap: 20px; grid-template-columns: repeat(auto-fill, minmax(min(100%, 340px), 1fr)); }
.ea-carte { display: grid; grid-template-rows: auto 1fr; overflow: hidden; border-radius: 20px; background: var(--bf-verre); border: 1px solid var(--bf-bord); }
.ea-apercu { display: block; position: relative; aspect-ratio: 16 / 10; overflow: hidden; background: var(--bf-verre-fort); border-bottom: 1px solid var(--bf-bord); }
.ea-apercu-lien { position: absolute; inset: 0; }
.ea-apercu iframe { position: absolute; top: 0; left: 0; border: 0; transform-origin: 0 0; pointer-events: none; background: #fff; }
.ea-corps { display: grid; gap: 14px; padding: 16px 18px 18px; align-content: start; }
.ea-nom { display: grid; gap: 2px; min-width: 0; }
.ea-nom a { font-size: 13px; color: var(--bf-doux); text-decoration: none; justify-self: start; }
.ea-nom a:hover { color: var(--bf-fort); }
.ea-etats { display: flex; flex-wrap: wrap; gap: 6px; }
.ea-etat { display: inline-flex; align-items: center; gap: 4px; padding: 5px 11px; border-radius: 999px; background: var(--bf-verre-fort); color: var(--bf-doux); font-size: 13px; font-weight: 500; text-decoration: none; }
.ea-etat--message { background: rgba(139, 92, 246, .16); color: var(--bf-fort); font-weight: 600; }
.ea-etat--publier { background: rgba(224, 122, 74, .16); color: var(--bf-fort); font-weight: 600; }
.ea-actions { display: flex; gap: 8px; }
.ea-btn { display: inline-flex; align-items: center; justify-content: center; min-height: 46px; padding: 0 20px; border-radius: 999px; background: var(--bf-verre-fort); box-shadow: inset 0 0 0 1px var(--bf-bord); color: var(--bf-texte); font-size: 15px; font-weight: 600; text-decoration: none; white-space: nowrap; }
.ea-btn:hover { background: var(--bf-survol); }
.ea-btn--fort { flex: 1; background: var(--bf-degrade); color: #fff; box-shadow: none; }
.ea-btn--fort:hover { background: var(--bf-degrade); filter: brightness(1.1); }
</style>
