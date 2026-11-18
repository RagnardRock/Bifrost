<script setup lang="ts">
/** Espace dev : tous les sites d'un coup d'œil, et ce qui s'y passe. */
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import Journal from '@/components/suivi/Journal.vue'
import { suiviService, ilYa, type SiteSuivi, type Evenement } from '@/services/suivi.service'

const router = useRouter()
const sites = ref<SiteSuivi[] | null>(null)
const activite = ref<Evenement[]>([])
const erreur = ref('')
const nouveau = ref<{ nom: string; url: string; dossier: string } | null>(null)
const occupe = ref(false)

async function charger() {
  try {
    ;[sites.value, activite.value] = await Promise.all([suiviService.sites(), suiviService.activite(undefined, 15)])
  } catch (e: any) {
    erreur.value = e?.response?.data?.error?.message || 'Impossible de charger les sites.'
  }
}

async function creer() {
  const n = nouveau.value
  if (!n) return
  occupe.value = true
  erreur.value = ''
  try {
    const r = await suiviService.creer(n.nom, n.url, n.dossier)
    nouveau.value = null
    router.push(`/admin/sites/${r.id}`)
  } catch (e: any) {
    erreur.value = e?.response?.data?.error?.message || 'Le site n’a pas pu être créé.'
  } finally {
    occupe.value = false
  }
}

const enLigne = (s: SiteSuivi) => s.url || `/sites/${s.id}/`

onMounted(charger)
</script>

<template>
  <div class="max-w-6xl">
    <div class="flex flex-wrap items-center justify-between gap-4 mb-8">
      <div>
        <h1 class="text-3xl font-bold">Sites</h1>
        <p class="text-gray-500 text-sm mt-1">Ce que vos clients modifient, publient, et qui fait partie de chaque équipe.</p>
      </div>
      <button type="button" class="btn-primary" @click="nouveau = { nom: '', url: '', dossier: '' }">+ Nouveau site</button>
    </div>

    <p v-if="erreur" class="glass-card p-4 mb-6 text-red-500" role="alert">{{ erreur }}</p>

    <div v-if="!sites" class="text-gray-500">Chargement…</div>
    <div v-else-if="!sites.length" class="glass-card p-10 text-center text-gray-500">Aucun site pour l’instant. Commencez par « Nouveau site ».</div>

    <div v-else class="grille">
      <article v-for="s in sites" :key="s.id" class="glass-card carte">
        <header>
          <router-link :to="`/admin/sites/${s.id}`" class="nom">{{ s.nom }}</router-link>
          <a :href="enLigne(s)" target="_blank" rel="noopener" class="adresse">{{ s.url || 'aperçu local' }}</a>
        </header>

        <div class="chiffres">
          <div :class="{ alerte: s.enAttente }">
            <strong>{{ s.enAttente ?? '–' }}</strong>
            <span>{{ s.enAttente === 1 ? 'modification en attente' : 'modifications en attente' }}</span>
          </div>
          <div>
            <strong>{{ s.membres }}</strong>
            <span>{{ s.membres > 1 ? 'membres' : 'membre' }}<template v-if="s.invitations"> · {{ s.invitations }} invité(s)</template></span>
          </div>
          <div>
            <strong>{{ s.pages ?? '–' }}</strong>
            <span>pages</span>
          </div>
        </div>

        <dl class="dates">
          <div>
            <dt>Publié</dt>
            <dd v-if="s.dernierePublication">{{ ilYa(s.dernierePublication.date) }}<template v-if="s.dernierePublication.auteur"> par {{ s.dernierePublication.auteur }}</template></dd>
            <dd v-else>jamais depuis l’import</dd>
          </div>
          <div>
            <dt>Activité</dt>
            <dd v-if="s.derniereActivite">{{ ilYa(s.derniereActivite.date) }}<template v-if="s.derniereActivite.auteur"> · {{ s.derniereActivite.auteur }}</template></dd>
            <dd v-else>aucune</dd>
          </div>
        </dl>

        <footer>
          <router-link :to="`/edition/${s.id}`" class="btn-primary">Éditer</router-link>
          <router-link :to="`/admin/sites/${s.id}`" class="glass-button">Fiche</router-link>
        </footer>
      </article>
    </div>

    <section class="mt-10">
      <div class="flex items-center justify-between mb-3">
        <h2 class="text-xl font-bold">Activité récente</h2>
        <router-link to="/admin/activite" class="text-sm text-blue-500 hover:underline">Tout voir</router-link>
      </div>
      <div class="glass-card p-2"><Journal :evenements="activite" avec-site /></div>
    </section>

    <!-- Nouveau site -->
    <div v-if="nouveau" class="fond" @click.self="nouveau = null">
      <form class="glass-card fenetre" @submit.prevent="creer">
        <h2 class="text-xl font-bold">Nouveau site</h2>
        <label>Nom<input v-model="nouveau.nom" class="input-field" required maxlength="120" placeholder="EHPAD Saint-Paulien"></label>
        <label>Adresse en ligne (facultatif)<input v-model="nouveau.url" class="input-field" placeholder="https://ehpad-saintpaulien.fr"></label>
        <label>Dossier du site sur le serveur<input v-model="nouveau.dossier" class="input-field" required placeholder="D:\Projets\ehpad-saintpaulien"></label>
        <p class="text-xs text-gray-500">Le dossier est copié (brouillon + version en ligne). Les dossiers .git, node_modules, outils et ancien-site sont ignorés.</p>
        <div class="flex justify-end gap-2">
          <button type="button" class="glass-button" @click="nouveau = null">Annuler</button>
          <button type="submit" class="btn-primary" :disabled="occupe">{{ occupe ? 'Import…' : 'Créer et importer' }}</button>
        </div>
      </form>
    </div>
  </div>
</template>

<style scoped>
.grille { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 20px; }
.carte { padding: 20px; display: grid; gap: 16px; border-radius: 16px; }
.carte header { display: grid; gap: 2px; }
.nom { font-size: 18px; font-weight: 700; }
.nom:hover { text-decoration: underline; }
.adresse { font-size: 13px; color: #6b7280; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.chiffres { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
.chiffres div { padding: 10px; border-radius: 12px; background: rgba(127, 127, 127, .08); display: grid; gap: 2px; }
.chiffres strong { font-size: 22px; line-height: 1.1; }
.chiffres span { font-size: 12px; color: #6b7280; line-height: 1.3; }
.chiffres .alerte { background: rgba(224, 122, 74, .16); }
.chiffres .alerte strong { color: #c2410c; }
.dates { display: grid; gap: 4px; margin: 0; font-size: 13px; }
.dates div { display: flex; gap: 8px; }
.dates dt { width: 64px; flex: none; color: #6b7280; }
.dates dd { margin: 0; overflow-wrap: anywhere; }
.carte footer { display: flex; gap: 8px; }
.fond { position: fixed; inset: 0; background: rgba(0, 0, 0, .45); backdrop-filter: blur(4px); display: grid; place-items: center; padding: 16px; z-index: 40; }
.fenetre { width: 100%; max-width: 520px; padding: 24px; display: grid; gap: 14px; border-radius: 18px; background: var(--fond-fenetre, rgba(255, 255, 255, .92)); }
:global(.dark) .fenetre { --fond-fenetre: rgba(17, 24, 39, .95); }
.fenetre label { display: grid; gap: 6px; font-size: 14px; font-weight: 600; }
.fenetre input { font-weight: 400; }
</style>
