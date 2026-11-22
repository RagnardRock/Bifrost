<script setup lang="ts">
/** Fiche d'un site côté dev : en attente, publications, équipe, journal, réglages. */
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import Journal from '@/components/suivi/Journal.vue'
import EnvoiSite, { type Envoi } from '@/components/suivi/EnvoiSite.vue'
import { suiviService, adresseSite, ilYa, type FicheSite, type Evenement, type EtatDomaine } from '@/services/suivi.service'
import { editeurService, type Membre, type Invitation } from '@/services/editeur.service'
import { clientsService, type Client } from '@/services/clients.service'

const route = useRoute()
const router = useRouter()
// L'adresse donne le nom court (ou l'uuid des anciens liens) ; une fois la fiche chargée on travaille avec l'identifiant
const id = computed(() => fiche.value?.site.id ?? (route.params.id as string))

const fiche = ref<FicheSite | null>(null)
const equipe = ref<{ membres: Membre[]; invitations: Invitation[] } | null>(null)
const journal = ref<Evenement[]>([])
const erreur = ref('')
const message = ref('')
const reglages = ref({ nom: '', url: '', slug: '', emailMessages: '' })
const dossier = ref('')
const voirFichiers = ref(false)
const occupe = ref(false)
const envoi = ref<Envoi | null>(null)
const progres = ref(0)
const cle = ref(0)

const enAttente = computed(() => {
  const d = fiche.value?.differences
  return d ? d.ajoutes.length + d.modifies.length + d.supprimes.length : 0
})

async function charger() {
  try {
    const f = await suiviService.fiche(id.value)
    fiche.value = f
    if (f.site.slug && route.params.id !== f.site.slug) router.replace(`/admin/sites/${f.site.slug}`)
    journal.value = await suiviService.activite(f.site.id, 50)
    reglages.value = { nom: f.site.name, url: f.site.url, slug: f.site.slug || '', emailMessages: f.site.emailMessages || '' }
    equipe.value = await editeurService.equipe(id.value).catch(() => null)
  } catch (e: any) {
    erreur.value = e?.response?.data?.error?.message || 'Impossible de charger ce site.'
  }
}

const etatDomaine = ref<EtatDomaine | null>(null)
async function verifierDomaine() {
  try { etatDomaine.value = await suiviService.domaine(fiche.value!.site.id) } catch { erreur.value = 'Vérification impossible.' }
}

async function enregistrer() {
  etatDomaine.value = null
  try {
    await suiviService.modifier(id.value, reglages.value.nom, reglages.value.url, reglages.value.slug, reglages.value.emailMessages)
    message.value = 'Enregistré'
    await charger()
  } catch (e: any) {
    erreur.value = e?.response?.data?.error?.message || 'Non enregistré.'
  }
}

async function reimporter() {
  if (!envoi.value && !dossier.value.trim()) return
  if (!window.confirm('Réimporter remplace le brouillon ET la version en ligne par le contenu du dossier. Continuer ?')) return
  occupe.value = true
  progres.value = 0
  try {
    if (envoi.value) await suiviService.reimporterEnvoi(id.value, envoi.value.archive, (p) => (progres.value = p))
    else await suiviService.reimporter(id.value, dossier.value)
    message.value = 'Site réimporté'
    dossier.value = ''
    envoi.value = null
    cle.value++
    await charger()
  } catch (e: any) {
    erreur.value = e?.response?.data?.error?.message || 'Réimport impossible.'
  } finally {
    occupe.value = false
  }
}

// ---------- double authentification d'un membre ----------
async function retirerDoubleAuth(m: Membre) {
  if (!window.confirm(`Retirer la double authentification de ${m.email} ? À faire seulement si la personne a perdu son téléphone et ses codes de secours. Elle pourra la réactiver depuis « Mon compte ».`)) return
  try {
    await suiviService.reinitialiserDoubleAuth(m.id)
    message.value = 'Double authentification retirée'
    equipe.value = await editeurService.equipe(id.value).catch(() => null)
  } catch (e: any) {
    erreur.value = e?.response?.data?.error?.message || 'Impossible.'
  }
}

// ---------- client, pause, export, suppression ----------
const clients = ref<Client[]>([])
const clientChoisi = ref('')
async function chargerClients() {
  clients.value = await clientsService.lister().catch(() => [])
  clientChoisi.value = fiche.value?.site.client?.id ?? ''
}
async function changerClient() {
  try {
    await suiviService.rattacher(id.value, clientChoisi.value || null)
    message.value = clientChoisi.value ? 'Site rattaché au client' : 'Site détaché'
    await charger()
  } catch (e: any) {
    erreur.value = e?.response?.data?.error?.message || 'Rattachement impossible.'
  }
}

async function basculerPause() {
  const pause = !fiche.value?.site.enPause
  if (pause && !window.confirm('Mettre le site en pause ? Les visiteurs verront « site momentanément indisponible » et le formulaire n’enverra plus rien. L’éditeur reste accessible.')) return
  try {
    await suiviService.pause(id.value, pause)
    message.value = pause ? 'Site en pause' : 'Site remis en ligne'
    await charger()
  } catch (e: any) {
    erreur.value = e?.response?.data?.error?.message || 'Impossible.'
  }
}

async function exporter(version: 'publie' | 'brouillon') {
  try { await suiviService.exporter(id.value, fiche.value?.site.slug || id.value, version) } catch { erreur.value = 'Export impossible.' }
}

const suppression = ref<string | null>(null)
async function supprimer() {
  if (!fiche.value || suppression.value === null) return
  try {
    await suiviService.supprimer(id.value, suppression.value)
    router.push('/admin')
  } catch (e: any) {
    erreur.value = e?.response?.data?.error?.message || 'Suppression impossible.'
  }
}

const dateLongue = (d: string) => new Date(d).toLocaleString('fr-FR', { dateStyle: 'long', timeStyle: 'short' })
const ROLES: Record<string, string> = { responsable: 'Responsable', redacteur: 'Rédacteur' }

onMounted(async () => { await charger(); await chargerClients() })
</script>

<template>
  <div>
    <router-link to="/admin" class="surtitre retour">← Tous les sites</router-link>

    <p v-if="erreur" class="glass-card p-4 my-4 text-red-500" role="alert" @click="erreur = ''">{{ erreur }}</p>
    <p v-if="message" class="glass-card p-4 my-4 text-green-600" role="status" @click="message = ''">{{ message }}</p>

    <template v-if="fiche">
      <div class="flex flex-wrap items-end justify-between gap-4 mb-10">
        <div>
          <h1>{{ fiche.site.name }} <span v-if="fiche.site.enPause" class="badge-pause">En pause</span></h1>
          <p class="chapeau">{{ fiche.pages }} page{{ fiche.pages > 1 ? 's' : '' }} · créé le {{ new Date(fiche.site.createdAt).toLocaleDateString('fr-FR') }}</p>
        </div>
        <div class="flex gap-2">
          <a :href="fiche.site.url || adresseSite(fiche.site)" target="_blank" rel="noopener" class="glass-button">Voir en ligne</a>
          <a :href="`/edition/${fiche.site.slug || fiche.site.id}`" target="_blank" rel="noopener" class="btn-primary">Ouvrir l’éditeur</a>
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
              <a :href="`/espace/sites/${fiche.site.slug || fiche.site.id}?onglet=equipe`" target="_blank" rel="noopener" class="text-sm text-blue-500 hover:underline">Gérer</a>
            </div>
            <p v-if="equipe && !equipe.membres.length" class="text-sm text-gray-500">Personne pour l’instant. Invitez le client depuis l’éditeur, bouton « Mon site ».</p>
            <ul v-if="equipe" class="lignes">
              <li v-for="m in equipe.membres" :key="m.id" class="membre">
                <div><strong>{{ m.email }}</strong><span>{{ ROLES[m.role] }} · depuis {{ ilYa(m.createdAt) }}<template v-if="m.parClient"> · accès client</template><template v-if="m.doubleAuth"> · 🔒 double authentification</template></span></div>
                <button v-if="m.doubleAuth" type="button" class="text-xs text-red-500 hover:underline" title="Si la personne a perdu son téléphone et ses codes de secours" @click="retirerDoubleAuth(m)">Retirer la 2FA</button>
              </li>
              <li v-for="i in equipe.invitations" :key="i.id" class="opacity-60"><div><strong>{{ i.email }}</strong><span>Invité · {{ ROLES[i.role] }}</span></div></li>
            </ul>
          </section>

          <section class="glass-card bloc">
            <div class="flex items-center justify-between">
              <h2>Client</h2>
              <router-link v-if="fiche.site.client" :to="`/admin/clients/${fiche.site.client.id}`" class="text-sm text-blue-500 hover:underline">Fiche</router-link>
            </div>
            <select v-model="clientChoisi" class="input-field" aria-label="Client du site" @change="changerClient">
              <option value="">Aucun client</option>
              <option v-for="c in clients" :key="c.id" :value="c.id">{{ c.nom }}</option>
            </select>
            <router-link v-if="!clients.length" to="/admin/clients" class="text-sm text-blue-500 hover:underline">Créer une fiche client</router-link>
          </section>

          <form class="glass-card bloc" @submit.prevent="enregistrer">
            <h2>Réglages</h2>
            <label>Nom<input v-model="reglages.nom" class="input-field" required maxlength="120"></label>
            <label>Nom court dans l’adresse Bifrost
              <span class="adresse-courte"><span>/sites/</span><input v-model="reglages.slug" class="input-field" pattern="[a-z0-9](?:[a-z0-9\-]{0,58}[a-z0-9])?" placeholder="mon-site" title="Lettres minuscules, chiffres et tirets"><span>/</span></span>
            </label>
            <label>Son propre domaine (facultatif)<input v-model="reglages.url" class="input-field" placeholder="https://monasso.fr">
              <span class="aide">Le site répond tout seul sur ce domaine, en HTTPS, dès qu’il pointe sur le serveur.</span>
            </label>
            <div v-if="fiche.site.url" class="domaine">
              <button type="button" class="text-sm text-blue-500 hover:underline justify-self-start" @click="verifierDomaine">{{ etatDomaine ? 'Vérifier à nouveau' : 'Vérifier le domaine' }}</button>
              <template v-if="etatDomaine">
                <p v-if="!etatDomaine.domaine" class="aide">Adresse invalide.</p>
                <p v-else-if="etatDomaine.ok" class="ok">✓ {{ etatDomaine.domaine }} pointe sur Bifrost{{ etatDomaine.wwwOk ? ', www aussi' : '' }}. Le certificat se crée à la première visite.</p>
                <div v-else class="aide">
                  <p>{{ etatDomaine.domaine }} ne pointe pas encore ici{{ etatDomaine.principal.length ? ` (il pointe sur ${etatDomaine.principal.join(', ')})` : '' }}.</p>
                  <p>Chez le registrar du client (OVH, Hostinger…), zone DNS : un enregistrement <strong>A</strong> pour <code>{{ etatDomaine.domaine }}</code> et un pour <code>www</code>, vers <code>{{ etatDomaine.attendu.join(', ') || 'l’adresse IP du serveur' }}</code>. Comptez de quelques minutes à quelques heures.</p>
                </div>
              </template>
            </div>
            <label>Messages du formulaire envoyés à
              <input v-model="reglages.emailMessages" class="input-field" placeholder="vide = les responsables du site" maxlength="500">
              <span class="aide">Une ou plusieurs adresses, séparées par des virgules.</span>
            </label>
            <button type="submit" class="btn-primary justify-self-start">Enregistrer</button>
          </form>

          <form class="glass-card bloc" @submit.prevent="reimporter">
            <h2>Réimporter le dossier</h2>
            <p class="text-xs text-gray-500">Après une refonte faite par le dev. Remplace le brouillon et la version en ligne.</p>
            <EnvoiSite :key="cle" @choisi="envoi = $event" />
            <details v-if="!envoi" class="avance">
              <summary>Dossier déjà présent sur le serveur</summary>
              <input v-model="dossier" class="input-field" placeholder="nom du dossier déposé (ou chemin en local)" aria-label="Dossier du site sur le serveur">
            </details>
            <button type="submit" class="glass-button justify-self-start text-red-500" :disabled="occupe || (!envoi && !dossier.trim())">{{ occupe ? (envoi && progres < 100 ? `Envoi… ${progres} %` : 'Import…') : 'Réimporter' }}</button>
          </form>

          <section class="glass-card bloc">
            <h2>Exporter</h2>
            <p class="text-xs text-gray-500">Le site en ZIP, pour le déposer chez un autre hébergeur. Ses formulaires continuent d’envoyer les messages à Bifrost.</p>
            <div class="flex flex-wrap gap-2">
              <button type="button" class="glass-button" @click="exporter('publie')">Version en ligne</button>
              <button type="button" class="glass-button" @click="exporter('brouillon')">Brouillon</button>
            </div>
          </section>

          <section class="glass-card bloc sensible">
            <h2>Zone sensible</h2>
            <div class="action">
              <div>
                <strong>{{ fiche.site.enPause ? 'Site en pause' : 'Mettre en pause' }}</strong>
                <span>{{ fiche.site.enPause ? 'Les visiteurs voient « momentanément indisponible ».' : 'Impayé, travaux… Le site affiche « momentanément indisponible ».' }}</span>
              </div>
              <button type="button" class="glass-button" @click="basculerPause">{{ fiche.site.enPause ? 'Remettre en ligne' : 'Mettre en pause' }}</button>
            </div>
            <div class="action">
              <div>
                <strong>Supprimer le site</strong>
                <span>Fichiers, équipe, publications et messages vont dans la corbeille 30 jours, puis sont effacés.</span>
              </div>
              <button type="button" class="glass-button text-red-500" @click="suppression = ''">Supprimer</button>
            </div>
            <p class="ident">Identifiant : <code>{{ fiche.site.id }}</code></p>
          </section>
        </div>
      </div>
    </template>

    <div v-if="suppression !== null && fiche" class="fond" @click.self="suppression = null">
      <form class="glass-card fenetre" @submit.prevent="supprimer">
        <h2 class="text-xl">Supprimer {{ fiche.site.name }} ?</h2>
        <p class="text-sm">Le site disparaît de Bifrost et de son adresse. Vous pourrez le restaurer depuis la liste des sites pendant 30 jours.</p>
        <label>Pour confirmer, tapez le nom du site : <strong>{{ fiche.site.name }}</strong>
          <input v-model="suppression" class="input-field" autocomplete="off" aria-label="Nom du site">
        </label>
        <div class="flex justify-end gap-2">
          <button type="button" class="glass-button" @click="suppression = null">Annuler</button>
          <button type="submit" class="btn-primary danger" :disabled="suppression.trim() !== fiche.site.name.trim()">Supprimer</button>
        </div>
      </form>
    </div>
  </div>
</template>

<style scoped>
.retour { text-decoration: none; }
.retour:hover { color: var(--bf-fort); }
.colonnes { display: grid; grid-template-columns: minmax(0, 2fr) minmax(0, 1fr); gap: 24px; align-items: start; }
@media (max-width: 1024px) { .colonnes { grid-template-columns: minmax(0, 1fr); } }
.bloc { padding: 20px; display: grid; gap: 12px; }
.bloc h2 { font-size: 16px; font-weight: 700; margin: 0; }
.bloc label { display: grid; gap: 6px; font-size: 14px; font-weight: 600; }
.adresse-courte { display: flex; align-items: center; gap: 6px; font-weight: 400; color: var(--bf-doux); }
.adresse-courte input { flex: 1; min-width: 0; }
.lignes { list-style: none; margin: 0; padding: 0; display: grid; gap: 6px; }
.lignes li { padding: 10px 12px; border-radius: 10px; background: var(--bf-verre); }
.lignes strong { display: block; font-size: 14px; overflow-wrap: anywhere; }
.lignes span { font-size: 12.5px; color: var(--bf-doux); }
.membre { display: flex; justify-content: space-between; align-items: center; gap: 10px; }
.membre > div { min-width: 0; }
.membre button { flex: none; }
.fichiers { list-style: none; margin: 0; padding: 0; font-family: ui-monospace, monospace; font-size: 12.5px; display: grid; gap: 4px; max-height: 260px; overflow: auto; }
.fichiers span { display: inline-block; width: 70px; font-family: system-ui, sans-serif; font-size: 11px; font-weight: 600; }
.ajout { color: var(--bf-ok); }
.modif { color: var(--bf-accent); }
.suppr { color: var(--bf-danger); }
.aide { font-size: 12.5px; font-weight: 400; color: var(--bf-doux); }
.domaine { display: grid; gap: 6px; }
.domaine p { margin: 0; }
.domaine code { font-size: 12px; }
.ok { font-size: 13px; color: #16a34a; margin: 0; }
.avance { font-size: 13px; color: var(--bf-doux); }
.avance summary { cursor: pointer; margin-bottom: 8px; }
.badge-pause { display: inline-block; vertical-align: middle; margin-left: 8px; padding: 3px 12px; border-radius: 999px; font-size: 13px; font-weight: 600; background: rgba(224, 122, 74, .16); color: var(--bf-accent); letter-spacing: 0; }
.sensible { box-shadow: inset 0 0 0 1px rgba(239, 68, 68, .25); }
.action { display: flex; justify-content: space-between; align-items: center; gap: 12px; }
.action > div { display: grid; gap: 2px; min-width: 0; }
.action strong { font-size: 14px; }
.action span { font-size: 12.5px; color: var(--bf-doux); }
.action .glass-button { flex: none; }
.ident { font-size: 12px; color: var(--bf-doux); margin: 0; overflow-wrap: anywhere; }
.ident code { font-size: 11.5px; user-select: all; }
.fond { position: fixed; inset: 0; background: var(--bf-voile); backdrop-filter: blur(4px); display: grid; place-items: center; padding: 16px; z-index: 40; }
.fenetre { width: 100%; max-width: 480px; padding: 24px; display: grid; gap: 14px; background: var(--bf-surface); }
.fenetre label { display: grid; gap: 8px; font-size: 14px; }
.danger { background: var(--bf-danger) !important; }
.danger:disabled { opacity: .45; }
</style>
