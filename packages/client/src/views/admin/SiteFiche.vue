<script setup lang="ts">
/** Fiche d'un site côté dev : en attente, publications, équipe, journal, réglages. */
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import Journal from '@/components/suivi/Journal.vue'
import { suiviService, ilYa, type FicheSite, type Evenement } from '@/services/suivi.service'
import { editeurService, type Membre, type Invitation } from '@/services/editeur.service'

const route = useRoute()
const id = computed(() => route.params.id as string)

const fiche = ref<FicheSite | null>(null)
const equipe = ref<{ membres: Membre[]; invitations: Invitation[] } | null>(null)
const journal = ref<Evenement[]>([])
const erreur = ref('')
const message = ref('')
const reglages = ref({ nom: '', url: '' })
const dossier = ref('')
const voirFichiers = ref(false)
const occupe = ref(false)

const enAttente = computed(() => {
  const d = fiche.value?.differences
  return d ? d.ajoutes.length + d.modifies.length + d.supprimes.length : 0
})

async function charger() {
  try {
    const [f, j] = await Promise.all([suiviService.fiche(id.value), suiviService.activite(id.value, 50)])
    fiche.value = f
    journal.value = j
    reglages.value = { nom: f.site.name, url: f.site.url }
    equipe.value = await editeurService.equipe(id.value).catch(() => null)
  } catch (e: any) {
    erreur.value = e?.response?.data?.error?.message || 'Impossible de charger ce site.'
  }
}

async function enregistrer() {
  try {
    await suiviService.modifier(id.value, reglages.value.nom, reglages.value.url)
    message.value = 'Enregistré'
    await charger()
  } catch (e: any) {
    erreur.value = e?.response?.data?.error?.message || 'Non enregistré.'
  }
}

async function reimporter() {
  if (!dossier.value.trim()) return
  if (!window.confirm('Réimporter remplace le brouillon ET la version en ligne par le contenu du dossier. Continuer ?')) return
  occupe.value = true
  try {
    await suiviService.reimporter(id.value, dossier.value)
    message.value = 'Site réimporté'
    dossier.value = ''
    await charger()
  } catch (e: any) {
    erreur.value = e?.response?.data?.error?.message || 'Réimport impossible.'
  } finally {
    occupe.value = false
  }
}

const dateLongue = (d: string) => new Date(d).toLocaleString('fr-FR', { dateStyle: 'long', timeStyle: 'short' })
const ROLES: Record<string, string> = { responsable: 'Responsable', redacteur: 'Rédacteur' }

onMounted(charger)
</script>

<template>
  <div class="max-w-6xl">
    <router-link to="/admin" class="text-sm text-blue-500 hover:underline">← Tous les sites</router-link>

    <p v-if="erreur" class="glass-card p-4 my-4 text-red-500" role="alert" @click="erreur = ''">{{ erreur }}</p>
    <p v-if="message" class="glass-card p-4 my-4 text-green-600" role="status" @click="message = ''">{{ message }}</p>

    <template v-if="fiche">
      <div class="flex flex-wrap items-end justify-between gap-4 mt-3 mb-8">
        <div>
          <h1 class="text-3xl font-bold">{{ fiche.site.name }}</h1>
          <p class="text-sm text-gray-500 mt-1">{{ fiche.pages }} pages · créé le {{ new Date(fiche.site.createdAt).toLocaleDateString('fr-FR') }}</p>
        </div>
        <div class="flex gap-2">
          <a :href="fiche.site.url || `/sites/${fiche.site.id}/`" target="_blank" rel="noopener" class="glass-button">Voir en ligne</a>
          <router-link :to="`/edition/${fiche.site.id}`" class="btn-primary">Ouvrir l’éditeur</router-link>
        </div>
      </div>

      <div class="colonnes">
        <div class="space-y-6">
          <section class="glass-card bloc">
            <h2>En attente de publication</h2>
            <p v-if="!enAttente" class="text-sm text-gray-500">Rien : le site en ligne est à jour.</p>
            <template v-else>
              <p class="text-sm"><strong>{{ enAttente }}</strong> fichier(s) modifié(s) dans le brouillon.
                <button type="button" class="text-blue-500 hover:underline" @click="voirFichiers = !voirFichiers">{{ voirFichiers ? 'Masquer' : 'Voir' }}</button></p>
              <ul v-if="voirFichiers && fiche.differences" class="fichiers">
                <li v-for="f in fiche.differences.ajoutes" :key="'a' + f"><span class="ajout">ajouté</span>{{ f }}</li>
                <li v-for="f in fiche.differences.modifies" :key="'m' + f"><span class="modif">modifié</span>{{ f }}</li>
                <li v-for="f in fiche.differences.supprimes" :key="'s' + f"><span class="suppr">supprimé</span>{{ f }}</li>
              </ul>
            </template>
          </section>

          <section class="glass-card bloc">
            <h2>Publications</h2>
            <p v-if="!fiche.publications.length" class="text-sm text-gray-500">Aucune publication depuis l’import.</p>
            <ul class="lignes">
              <li v-for="p in fiche.publications" :key="p.id" :class="{ 'opacity-50': p.annulee }">
                <div>
                  <strong>{{ dateLongue(p.createdAt) }}</strong>
                  <span>{{ p.auteur || '—' }} · {{ p.ajoutes.length + p.modifies.length + p.supprimes.length }} fichier(s){{ p.annulee ? ' · annulée' : '' }}</span>
                </div>
              </li>
            </ul>
          </section>

          <section class="glass-card bloc">
            <h2>Journal</h2>
            <Journal :evenements="journal" />
          </section>
        </div>

        <div class="space-y-6">
          <section class="glass-card bloc">
            <div class="flex items-center justify-between">
              <h2>Équipe</h2>
              <router-link :to="`/edition/${fiche.site.id}`" class="text-sm text-blue-500 hover:underline" title="L’équipe se gère depuis le bouton 👥 de l’éditeur">Gérer</router-link>
            </div>
            <p v-if="equipe && !equipe.membres.length" class="text-sm text-gray-500">Personne pour l’instant. Invitez le client depuis l’éditeur (👥).</p>
            <ul v-if="equipe" class="lignes">
              <li v-for="m in equipe.membres" :key="m.id"><div><strong>{{ m.email }}</strong><span>{{ ROLES[m.role] }} · depuis {{ ilYa(m.createdAt) }}</span></div></li>
              <li v-for="i in equipe.invitations" :key="i.id" class="opacity-60"><div><strong>{{ i.email }}</strong><span>Invité · {{ ROLES[i.role] }}</span></div></li>
            </ul>
          </section>

          <form class="glass-card bloc" @submit.prevent="enregistrer">
            <h2>Réglages</h2>
            <label>Nom<input v-model="reglages.nom" class="input-field" required maxlength="120"></label>
            <label>Adresse en ligne<input v-model="reglages.url" class="input-field" placeholder="https://…"></label>
            <button type="submit" class="btn-primary justify-self-start">Enregistrer</button>
          </form>

          <form class="glass-card bloc" @submit.prevent="reimporter">
            <h2>Réimporter le dossier</h2>
            <p class="text-xs text-gray-500">Après une refonte faite par le dev. Remplace le brouillon et la version en ligne.</p>
            <input v-model="dossier" class="input-field" placeholder="nom du dossier déposé (ou chemin en local)" aria-label="Dossier du site sur le serveur">
            <button type="submit" class="glass-button justify-self-start text-red-500" :disabled="occupe || !dossier.trim()">{{ occupe ? 'Import…' : 'Réimporter' }}</button>
          </form>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.colonnes { display: grid; grid-template-columns: minmax(0, 2fr) minmax(0, 1fr); gap: 24px; align-items: start; }
@media (max-width: 1024px) { .colonnes { grid-template-columns: minmax(0, 1fr); } }
.bloc { padding: 20px; display: grid; gap: 12px; }
.bloc h2 { font-size: 16px; font-weight: 700; margin: 0; }
.bloc label { display: grid; gap: 6px; font-size: 14px; font-weight: 600; }
.lignes { list-style: none; margin: 0; padding: 0; display: grid; gap: 6px; }
.lignes li { padding: 10px 12px; border-radius: 10px; background: var(--bf-verre); }
.lignes strong { display: block; font-size: 14px; overflow-wrap: anywhere; }
.lignes span { font-size: 12.5px; color: var(--bf-doux); }
.fichiers { list-style: none; margin: 0; padding: 0; font-family: ui-monospace, monospace; font-size: 12.5px; display: grid; gap: 4px; max-height: 260px; overflow: auto; }
.fichiers span { display: inline-block; width: 70px; font-family: system-ui, sans-serif; font-size: 11px; font-weight: 600; }
.ajout { color: var(--bf-ok); }
.modif { color: var(--bf-accent); }
.suppr { color: var(--bf-danger); }
</style>
