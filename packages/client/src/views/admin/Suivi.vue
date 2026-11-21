<script setup lang="ts">
/** Espace dev : tous les sites d'un coup d'œil, et ce qui s'y passe. */
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import Journal from '@/components/suivi/Journal.vue'
import EnvoiSite, { type Envoi } from '@/components/suivi/EnvoiSite.vue'
import { suiviService, adresseSite, ilYa, type SiteSuivi, type Evenement, type SiteSupprime } from '@/services/suivi.service'

const router = useRouter()
const sites = ref<SiteSuivi[] | null>(null)
const activite = ref<Evenement[]>([])
const erreur = ref('')
const nouveau = ref<{ nom: string; url: string; dossier: string } | null>(null)
const occupe = ref(false)
const envoi = ref<Envoi | null>(null)
const progres = ref(0)

const corbeille = ref<SiteSupprime[]>([])

async function charger() {
  try {
    ;[sites.value, activite.value, corbeille.value] = await Promise.all([suiviService.sites(), suiviService.activite(undefined, 15), suiviService.corbeille().catch(() => [])])
  } catch (e: any) {
    erreur.value = e?.response?.data?.error?.message || 'Impossible de charger les sites.'
  }
}

async function creer() {
  const n = nouveau.value
  if (!n) return
  if (!envoi.value && !n.dossier.trim()) { erreur.value = 'Choisissez le dossier du site (ou un ZIP).'; return }
  occupe.value = true
  progres.value = 0
  erreur.value = ''
  try {
    const r = envoi.value
      ? await suiviService.creerEnvoi(n.nom, n.url, envoi.value.archive, (p) => (progres.value = p))
      : await suiviService.creer(n.nom, n.url, n.dossier)
    nouveau.value = null
    envoi.value = null
    router.push(`/admin/sites/${r.id}`)
  } catch (e: any) {
    erreur.value = e?.response?.data?.error?.message || 'Le site n’a pas pu être créé.'
  } finally {
    occupe.value = false
  }
}

async function restaurer(s: SiteSupprime) {
  try {
    const r = await suiviService.restaurer(s.id)
    router.push(`/admin/sites/${r.slug || r.id}`)
  } catch (e: any) {
    erreur.value = e?.response?.data?.error?.message || 'Restauration impossible.'
  }
}
async function effacer(s: SiteSupprime) {
  if (!window.confirm(`Effacer définitivement ${s.nom} ? Ses fichiers et ses messages seront perdus.`)) return
  try { await suiviService.effacer(s.id); await charger() } catch (e: any) { erreur.value = e?.response?.data?.error?.message || 'Effacement impossible.' }
}

const enLigne = (s: SiteSuivi) => s.url || adresseSite(s)

onMounted(charger)
</script>

<template>
  <div>
    <div class="flex flex-wrap items-end justify-between gap-4 mb-10">
      <div>
        <span class="surtitre">Espace développeur</span>
        <h1>Sites</h1>
        <p class="chapeau">Ce que vos clients modifient, publient, et qui fait partie de chaque équipe.</p>
      </div>
      <button type="button" class="btn-primary" @click="nouveau = { nom: '', url: '', dossier: '' }">+ Nouveau site</button>
    </div>

    <p v-if="erreur" class="glass-card p-4 mb-6 text-red-500" role="alert">{{ erreur }}</p>

    <div v-if="!sites" class="text-gray-500">Chargement…</div>
    <div v-else-if="!sites.length" class="glass-card p-10 text-center text-gray-500">Aucun site pour l’instant. Commencez par « Nouveau site ».</div>

    <div v-else class="grille">
      <article v-for="s in sites" :key="s.id" class="glass-card bf-carte carte">
        <header>
          <router-link :to="`/admin/sites/${s.slug || s.id}`" class="nom">{{ s.nom }}</router-link>
          <a :href="enLigne(s)" target="_blank" rel="noopener" class="adresse">{{ s.url || `bifrost › ${s.slug || 'site'}` }}</a>
          <div v-if="s.client || s.enPause" class="etiquettes">
            <router-link v-if="s.client" :to="`/admin/clients/${s.client.id}`" class="etiquette">{{ s.client.nom }}</router-link>
            <span v-if="s.enPause" class="etiquette etiquette--pause">En pause</span>
          </div>
        </header>

        <div class="chiffres">
          <div :class="{ alerte: s.enAttente }">
            <strong>{{ s.enAttente ?? '–' }}</strong>
            <span>{{ s.enAttente === 1 ? 'fichier en attente' : 'fichiers en attente' }}</span>
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
          <a :href="`/edition/${s.slug || s.id}`" target="_blank" rel="noopener" class="btn-primary">Éditer</a>
          <router-link :to="`/admin/sites/${s.slug || s.id}`" class="glass-button">Fiche</router-link>
        </footer>
      </article>
    </div>

    <section v-if="corbeille.length" class="mt-10">
      <h2 class="text-xl mb-3">Sites supprimés</h2>
      <ul class="corbeille">
        <li v-for="s in corbeille" :key="s.id" class="glass-card">
          <div>
            <strong>{{ s.nom }}</strong>
            <span>supprimé {{ ilYa(s.supprimeLe) }} · effacé le {{ new Date(s.effaceLe).toLocaleDateString('fr-FR') }}<template v-if="s.messages"> · {{ s.messages }} message(s)</template></span>
          </div>
          <div class="flex gap-2">
            <button type="button" class="glass-button" @click="restaurer(s)">Restaurer</button>
            <button type="button" class="glass-button text-red-500" @click="effacer(s)">Effacer</button>
          </div>
        </li>
      </ul>
    </section>

    <section class="mt-14">
      <div class="flex items-center justify-between mb-3">
        <h2 class="text-xl">Activité récente</h2>
        <router-link to="/admin/activite" class="text-sm text-blue-500 hover:underline">Tout voir</router-link>
      </div>
      <div class="glass-card p-2"><Journal :evenements="activite" avec-site /></div>
    </section>

    <!-- Nouveau site -->
    <div v-if="nouveau" class="fond" @click.self="nouveau = null; envoi = null">
      <form class="glass-card fenetre" @submit.prevent="creer">
        <h2 class="text-xl">Nouveau site</h2>
        <label>Nom<input v-model="nouveau.nom" class="input-field" required maxlength="120" placeholder="Nom du client ou du site"></label>
        <label>Adresse en ligne (facultatif)<input v-model="nouveau.url" class="input-field" placeholder="https://exemple.fr"></label>
        <div class="champ">
          <span>Le site</span>
          <EnvoiSite @choisi="envoi = $event" />
          <p class="text-xs text-gray-500">Copié en brouillon et en version en ligne. Les dossiers .git, node_modules, outils et ancien-site sont ignorés.</p>
        </div>
        <details v-if="!envoi" class="avance">
          <summary>Dossier déjà présent sur le serveur</summary>
          <input v-model="nouveau.dossier" class="input-field" placeholder="nom du dossier, ou chemin complet en local" aria-label="Dossier du site sur le serveur">
        </details>
        <div class="flex justify-end gap-2">
          <button type="button" class="glass-button" @click="nouveau = null; envoi = null">Annuler</button>
          <button type="submit" class="btn-primary" :disabled="occupe">{{ occupe ? (envoi && progres < 100 ? `Envoi… ${progres} %` : 'Import…') : 'Créer et importer' }}</button>
        </div>
      </form>
    </div>
  </div>
</template>

<style scoped>
.grille { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 20px; }
.carte { padding: 20px; display: grid; gap: 16px; box-shadow: none; }
.carte header { display: grid; gap: 2px; }
.nom { font-size: 18px; font-weight: 650; color: var(--bf-fort); letter-spacing: -.01em; }
.nom:hover { text-decoration: underline; }
.adresse { font-size: 13px; color: var(--bf-doux); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.chiffres { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
.chiffres div { padding: 10px; border-radius: 12px; background: var(--bf-verre); display: grid; gap: 2px; }
.chiffres strong { font-size: 22px; line-height: 1.1; color: var(--bf-fort); font-variant-numeric: tabular-nums; }
.chiffres span { font-size: 12px; color: var(--bf-doux); line-height: 1.3; }
.chiffres .alerte { background: rgba(224, 122, 74, .14); box-shadow: inset 0 0 0 1px rgba(224, 122, 74, .3); }
.chiffres .alerte strong { color: var(--bf-accent); }
.dates { display: grid; gap: 4px; margin: 0; font-size: 13px; }
.dates div { display: flex; gap: 8px; }
.dates dt { width: 64px; flex: none; color: var(--bf-doux); }
.dates dd { margin: 0; overflow-wrap: anywhere; }
.carte footer { display: flex; gap: 8px; }
.etiquettes { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 6px; }
.etiquette { padding: 2px 10px; border-radius: 999px; font-size: 12px; font-weight: 600; background: var(--bf-verre-fort); color: var(--bf-texte); text-decoration: none; }
a.etiquette:hover { color: var(--bf-fort); }
.etiquette--pause { background: rgba(224, 122, 74, .16); color: var(--bf-accent); }
.corbeille { list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; }
.corbeille li { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 10px; padding: 12px 16px; box-shadow: none; }
.corbeille li > div:first-child { display: grid; gap: 2px; }
.corbeille span { font-size: 13px; color: var(--bf-doux); }
.fond { position: fixed; inset: 0; background: var(--bf-voile); backdrop-filter: blur(4px); display: grid; place-items: center; padding: 16px; z-index: 40; }
.fenetre { width: 100%; max-width: 520px; padding: 24px; display: grid; gap: 14px; background: var(--bf-surface); }
.fenetre label { display: grid; gap: 6px; font-size: 14px; font-weight: 600; }
.fenetre input { font-weight: 400; }
.champ { display: grid; gap: 6px; font-size: 14px; font-weight: 600; }
.avance { font-size: 13px; color: var(--bf-doux); }
.avance summary { cursor: pointer; margin-bottom: 8px; }
</style>
