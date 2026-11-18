<script setup lang="ts">
/**
 * Éditeur sur place : le vrai site dans un cadre, modifiable au clic.
 * Le script injecté dans l'aperçu (overlay.js) envoie les modifications ici ; on appelle l'API.
 */
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { editeurService, type EtatEditeur, type Publication, type Membre, type Invitation, type RoleSite } from '@/services/editeur.service'
import { adresseSite } from '@/services/suivi.service'
import { comptesService, type MonSite } from '@/services/comptes.service'
import { useAuthStore } from '@/stores/auth.store'
import { useUIStore } from '@/stores/ui.store'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const ui = useUIStore()

const etat = ref<EtatEditeur | null>(null)
// L'adresse donne le nom court (ou l'uuid des anciens liens) ; une fois l'état chargé on travaille avec l'identifiant
const siteId = computed(() => etat.value?.site.id ?? (route.params.siteId as string))
const page = ref('index.html')
const titrePage = ref('')
const modele = ref<string | null>(null)
const cadre = ref<HTMLIFrameElement | null>(null)
const cle = ref(0)
const erreur = ref('')
const message = ref('')
const occupe = ref(false)
const vueMobile = ref(false)

const nbModifs = computed(() => etat.value?.changements.length ?? 0)
const detailModifs = computed(() => (etat.value?.changements ?? []).map((c) => `• ${c.texte}`).join('\n'))
const modifsTexte = (n: number) => `${n} modification${n > 1 ? 's' : ''}`
const resumePublication = (p: Publication) => p.changements?.length
  ? modifsTexte(p.changements.length)
  : `${p.modifies.length + p.ajoutes.length + p.supprimes.length} fichier(s)`
const responsable = computed(() => etat.value?.moi.role === 'responsable')
const src = computed(() => `/apercu/${siteId.value}/${page.value}`)

let minuteur: number | undefined
function informer(t: string) {
  message.value = t
  clearTimeout(minuteur)
  minuteur = window.setTimeout(() => (message.value = ''), 3500)
}
function echec(e: any, defaut = 'La modification n’a pas pu être enregistrée.') {
  erreur.value = e?.response?.data?.error?.message || defaut
}

// Plusieurs sites : menu pour passer de l'un à l'autre (clients seulement ; le dev a son espace)
const mesSites = ref<MonSite[]>([])
async function chargerMesSites() {
  if (auth.role !== 'client') return
  try { mesSites.value = await comptesService.mesSites() } catch { mesSites.value = [] }
}
async function changerDeSite(id: string) {
  const s = mesSites.value.find((x) => x.id === id)
  if (!s || s.id === etat.value?.site.id) return
  try {
    auth.ouvrirSession(await comptesService.changerSite(s.id), false)
    window.location.assign(`/edition/${s.slug || s.id}`)
  } catch (err) { echec(err, 'Impossible d’ouvrir ce site.') }
}

async function rafraichirEtat() {
  etat.value = await editeurService.etat(siteId.value)
  const slug = etat.value.site.slug
  if (slug && route.params.siteId !== slug) router.replace({ params: { siteId: slug }, query: route.query })
}
function recharger() {
  cadre.value?.contentWindow?.postMessage({ source: 'bifrost-parent', type: 'avant-rechargement' }, '*')
  setTimeout(() => (cle.value++), 30)
}

// ---------- messages venant de l'aperçu ----------
const champImage = ref<{ cle: string; liste: string | null; index: number | null } | null>(null)
const choixImage = ref<HTMLInputElement | null>(null)
const confirmation = ref<{ texte: string; action: () => Promise<void> } | null>(null)

async function surMessage(e: MessageEvent) {
  if (e.source !== cadre.value?.contentWindow || e.data?.source !== 'bifrost') return
  const m = e.data
  erreur.value = ''
  try {
    if (m.type === 'page') {
      page.value = m.page
      titrePage.value = (m.titre || '').split('|')[0].trim()
      modele.value = m.modele
    } else if (m.type === 'champ') {
      if (m.liste) await editeurService.operationListe(siteId.value, { page: m.page, nom: m.liste, op: 'modifier', index: m.index, cle: m.cle, valeur: m.valeur })
      else await editeurService.modifierChamp(siteId.value, m.cle, m.valeur)
      informer('Enregistré dans le brouillon')
      await rafraichirEtat()
    } else if (m.type === 'image') {
      champImage.value = { cle: m.cle, liste: m.liste, index: m.index }
      choixImage.value?.click()
    } else if (m.type === 'liste') {
      const faire = async () => {
        await editeurService.operationListe(siteId.value, { page: m.page, nom: m.nom, op: m.op, index: m.index, vers: m.vers })
        await rafraichirEtat()
        recharger()
      }
      if (m.demanderConfirmation) confirmation.value = { texte: m.nom === modele.value || m.nom === 'actualites' ? 'Supprimer cette actualité et sa page ?' : 'Supprimer cet élément ?', action: faire }
      else await faire()
    } else if (m.type === 'info') {
      informer(m.texte)
    }
  } catch (err) {
    echec(err)
  }
}

async function surImage(ev: Event) {
  const input = ev.target as HTMLInputElement
  const f = input.files?.[0]
  input.value = ''
  const c = champImage.value
  if (!f || !c) return
  occupe.value = true
  try {
    const { chemin } = await editeurService.envoyerImage(siteId.value, f)
    if (c.liste !== null && c.index !== null) await editeurService.operationListe(siteId.value, { page: page.value, nom: c.liste, op: 'modifier', index: c.index, cle: c.cle, valeur: chemin })
    else await editeurService.modifierChamp(siteId.value, c.cle, chemin)
    await rafraichirEtat()
    recharger()
    informer('Photo remplacée')
  } catch (err) {
    echec(err, 'La photo n’a pas pu être envoyée.')
  } finally {
    occupe.value = false
  }
}

// ---------- nouvelle actualité ----------
const nouvelle = ref<{ titre: string; date: string; texte: string; photos: { chemin: string; apercu: string }[] } | null>(null)
const nomCollection = computed(() => modele.value || 'actualites')
function ouvrirNouvelle() {
  nouvelle.value = { titre: '', date: new Date().toISOString().slice(0, 10), texte: '', photos: [] }
}
async function ajouterPhotos(ev: Event) {
  const input = ev.target as HTMLInputElement
  const fichiers = Array.from(input.files || [])
  input.value = ''
  occupe.value = true
  try {
    for (const f of fichiers) {
      const { chemin } = await editeurService.envoyerImage(siteId.value, f)
      nouvelle.value?.photos.push({ chemin, apercu: URL.createObjectURL(f) })
    }
  } catch (err) {
    echec(err, 'Une photo n’a pas pu être envoyée.')
  } finally {
    occupe.value = false
  }
}
async function creerNouvelle() {
  const n = nouvelle.value
  if (!n || !n.titre.trim()) return
  occupe.value = true
  try {
    const texte = n.texte.trim() ? n.texte.trim().split(/\n{2,}/).map((p) => `<p>${p.replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c] as string)).replace(/\n/g, '<br>')}</p>`).join('') : ''
    const { page: p } = await editeurService.nouvelElement(siteId.value, nomCollection.value, { titre: n.titre.trim(), date: n.date || undefined, texte, photos: n.photos.map((x) => x.chemin) })
    nouvelle.value = null
    await rafraichirEtat()
    page.value = p
    cle.value++
    informer('Actualité créée. Pensez à publier.')
  } catch (err) {
    echec(err)
  } finally {
    occupe.value = false
  }
}

// ---------- équipe ----------
const equipe = ref<{ membres: Membre[]; invitations: Invitation[] } | null>(null)
const invitation = ref<{ email: string; role: RoleSite }>({ email: '', role: 'redacteur' })
const lienInvitation = ref<{ email: string; lien: string; envoye: boolean; ajoute: boolean } | null>(null)
const ROLES: Record<RoleSite, string> = { responsable: 'Responsable', redacteur: 'Rédacteur' }
async function ouvrirEquipe() {
  lienInvitation.value = null
  equipe.value = await editeurService.equipe(siteId.value)
}
async function inviter() {
  const email = invitation.value.email.trim()
  if (!email) return
  try {
    const r = await editeurService.inviter(siteId.value, email, invitation.value.role)
    lienInvitation.value = { email, ...r }
    invitation.value.email = ''
    equipe.value = await editeurService.equipe(siteId.value)
  } catch (err) {
    echec(err, 'L’invitation n’a pas pu être créée.')
  }
}
async function copier(t: string) {
  try { await navigator.clipboard.writeText(t); informer('Lien copié') } catch { informer('Sélectionnez le lien pour le copier') }
}
async function changerRole(m: Membre, role: RoleSite) {
  try { await editeurService.changerRole(siteId.value, m.id, role); m.role = role; informer('Rôle modifié') } catch (err) { echec(err); equipe.value = await editeurService.equipe(siteId.value) }
}
function retirer(m: Membre) {
  confirmation.value = {
    texte: `Retirer ${m.email} de l’équipe ? Cette personne ne pourra plus modifier le site.`,
    action: async () => { await editeurService.retirer(siteId.value, m.id); equipe.value = await editeurService.equipe(siteId.value) },
  }
}
async function annulerInvitation(i: Invitation) {
  try { await editeurService.annulerInvitation(siteId.value, i.id); equipe.value = await editeurService.equipe(siteId.value) } catch (err) { echec(err) }
}

// ---------- publication et historique ----------
const historique = ref<Publication[] | null>(null)
async function publier() {
  occupe.value = true
  try {
    const { publication } = await editeurService.publier(siteId.value)
    await rafraichirEtat()
    informer(publication ? 'Votre site est à jour en ligne.' : 'Rien à publier.')
  } catch (err) {
    echec(err, 'La publication a échoué.')
  } finally {
    occupe.value = false
  }
}
async function ouvrirHistorique() {
  historique.value = await editeurService.publications(siteId.value)
}
function annulerPublication(p: Publication) {
  confirmation.value = {
    texte: 'Remettre le site tel qu’il était avant cette publication ?',
    action: async () => {
      await editeurService.annuler(siteId.value, p.id)
      await rafraichirEtat()
      historique.value = await editeurService.publications(siteId.value)
      recharger()
      informer('Publication annulée.')
    },
  }
}
function abandonner() {
  confirmation.value = {
    texte: 'Effacer toutes les modifications non publiées ?',
    action: async () => {
      await editeurService.abandonner(siteId.value)
      await rafraichirEtat()
      recharger()
      informer('Modifications effacées.')
    },
  }
}
async function confirmer() {
  const c = confirmation.value
  confirmation.value = null
  if (!c) return
  try { await c.action() } catch (err) { echec(err) }
}
const dateLisible = (d: string) => new Date(d).toLocaleString('fr-FR', { dateStyle: 'long', timeStyle: 'short' })
const nomPage = (p: string) => {
  const n = p.replace(/\.html$/, '').replace(/^index$/, 'Accueil').replace(/[-/]/g, ' ')
  return n.charAt(0).toUpperCase() + n.slice(1)
}

function deconnexion() {
  auth.logout?.()
  router.push('/login')
}

onMounted(async () => {
  window.addEventListener('message', surMessage)
  try {
    await editeurService.ouvrirSession(siteId.value)
    await rafraichirEtat()
    void chargerMesSites()
  } catch (err) {
    echec(err, 'Impossible d’ouvrir l’éditeur.')
  }
})
onBeforeUnmount(() => window.removeEventListener('message', surMessage))
</script>

<template>
  <div class="ed">
    <header class="ed-barre">
      <div class="ed-gauche">
        <span class="ed-logo" aria-hidden="true">ᛒ</span>
        <div class="ed-titre">
          <select v-if="etat && mesSites.length > 1" class="ed-sites" aria-label="Changer de site" :value="etat.site.id"
            @change="changerDeSite(($event.target as HTMLSelectElement).value)">
            <option v-for="s in mesSites" :key="s.id" :value="s.id">{{ s.nom }}</option>
          </select>
          <strong v-else>{{ etat?.site.name || 'Bifrost' }}</strong>
          <select v-if="etat" v-model="page" class="ed-pages" aria-label="Page à modifier" @change="cle++">
            <option v-for="p in etat.pages.filter((x) => !x.includes('/'))" :key="p" :value="p">{{ nomPage(p) }}</option>
            <option v-if="page.includes('/')" :value="page">{{ titrePage || nomPage(page) }}</option>
          </select>
        </div>
      </div>
      <div class="ed-actions">
        <button class="ed-btn ed-btn--clair" type="button" @click="ouvrirNouvelle">+ Actualité</button>
        <button class="ed-btn ed-btn--icone" type="button" :aria-pressed="vueMobile" title="Voir comme sur un téléphone" @click="vueMobile = !vueMobile">📱</button>
        <template v-if="responsable">
          <button class="ed-btn ed-btn--icone" type="button" title="Équipe : qui peut modifier le site" @click="ouvrirEquipe">👥</button>
          <button class="ed-btn ed-btn--icone" type="button" title="Historique des publications" @click="ouvrirHistorique">🕘</button>
          <button class="ed-btn ed-btn--publier" type="button" :disabled="!nbModifs || occupe" :title="detailModifs" @click="publier">
            {{ nbModifs ? `Publier (${nbModifs})` : 'À jour' }}
          </button>
        </template>
        <span v-else-if="etat" class="ed-attente" :title="nbModifs ? `${detailModifs}\n\nUn responsable du site publiera vos modifications.` : ''">
          {{ nbModifs ? `${modifsTexte(nbModifs)} en attente de publication` : 'Tout est publié' }}
        </span>
      </div>
    </header>

    <div class="ed-aide">
      Cliquez sur un texte pour le modifier, sur une photo pour la changer. Survolez une actualité pour la déplacer ou la supprimer.
      <button v-if="nbModifs && responsable" type="button" class="ed-lien" @click="abandonner">Effacer mes modifications</button>
      <a :href="adresseSite(etat?.site ?? { id: siteId })" target="_blank" rel="noopener" class="ed-lien">Voir le site en ligne</a>
      <router-link v-if="etat?.moi.dev" :to="`/admin/sites/${etat?.site.slug || siteId}`" class="ed-lien">Fiche du site (dev)</router-link>
      <button type="button" class="ed-lien" :title="`Thème : ${ui.theme === 'system' ? 'comme l’appareil' : ui.theme}`" @click="ui.basculerTheme()">{{ ui.theme === 'dark' ? '🌙 Sombre' : ui.theme === 'light' ? '☀️ Clair' : '💻 Auto' }}</button>
      <button type="button" class="ed-lien" @click="deconnexion">Se déconnecter</button>
    </div>

    <main class="ed-scene" :class="{ 'ed-scene--mobile': vueMobile }">
      <iframe v-if="etat" :key="cle" ref="cadre" :src="src" title="Votre site" class="ed-cadre" />
    </main>

    <input ref="choixImage" type="file" accept="image/*" hidden @change="surImage">

    <transition name="ed-fondu">
      <div v-if="message || erreur" class="ed-toast" :class="{ 'ed-toast--erreur': erreur }" role="status" @click="erreur = ''">
        {{ erreur || message }}
      </div>
    </transition>
    <div v-if="occupe" class="ed-occupe" aria-live="polite">Un instant…</div>

    <!-- Nouvelle actualité -->
    <div v-if="nouvelle" class="ed-fond" @click.self="nouvelle = null">
      <form class="ed-fenetre" @submit.prevent="creerNouvelle">
        <h2>Nouvelle actualité</h2>
        <label>Titre<input v-model="nouvelle.titre" required maxlength="200" placeholder="Ex. : Repas de Noël avec les familles" autofocus></label>
        <label>Date<input v-model="nouvelle.date" type="date"></label>
        <label>Texte (facultatif)<textarea v-model="nouvelle.texte" rows="5" placeholder="Quelques lignes pour raconter le moment…" /></label>
        <div>
          <span class="ed-etiquette">Photos</span>
          <div class="ed-photos">
            <img v-for="p in nouvelle.photos" :key="p.chemin" :src="p.apercu" alt="">
            <label class="ed-ajout-photo">+ Ajouter<input type="file" accept="image/*" multiple hidden @change="ajouterPhotos"></label>
          </div>
        </div>
        <div class="ed-boutons">
          <button type="button" class="ed-btn ed-btn--clair" @click="nouvelle = null">Annuler</button>
          <button type="submit" class="ed-btn ed-btn--publier" :disabled="!nouvelle.titre.trim() || occupe">Créer l’actualité</button>
        </div>
      </form>
    </div>

    <!-- Historique -->
    <div v-if="historique" class="ed-fond" @click.self="historique = null">
      <div class="ed-fenetre">
        <h2>Historique des publications</h2>
        <p v-if="!historique.length">Aucune publication pour l’instant.</p>
        <ul class="ed-histo">
          <li v-for="(p, i) in historique" :key="p.id" :class="{ 'ed-annulee': p.annulee }">
            <div>
              <strong>{{ dateLisible(p.createdAt) }}</strong>
              <span :title="p.changements?.map((c) => `• ${c.texte}`).join('\n')">{{ resumePublication(p) }} · {{ p.annulee ? 'annulée' : 'en ligne' }}</span>
            </div>
            <button v-if="!p.annulee && i === historique.findIndex((x) => !x.annulee)" type="button" class="ed-btn ed-btn--clair" @click="annulerPublication(p)">Revenir avant</button>
          </li>
        </ul>
        <div class="ed-boutons"><button type="button" class="ed-btn ed-btn--clair" @click="historique = null">Fermer</button></div>
      </div>
    </div>

    <!-- Équipe -->
    <div v-if="equipe" class="ed-fond" @click.self="equipe = null">
      <div class="ed-fenetre">
        <h2>Équipe du site</h2>
        <p class="ed-note">Les <strong>responsables</strong> publient et gèrent l’équipe. Les <strong>rédacteurs</strong> modifient le site ; un responsable publie ensuite.</p>
        <ul class="ed-histo">
          <li v-for="m in equipe.membres" :key="m.id">
            <div><strong>{{ m.email }}</strong><span v-if="m.id === etat?.moi.id">C’est vous</span></div>
            <div class="ed-ligne">
              <select :value="m.role" class="ed-select" :disabled="m.id === etat?.moi.id" aria-label="Rôle" @change="changerRole(m, ($event.target as HTMLSelectElement).value as RoleSite)">
                <option v-for="(lib, r) in ROLES" :key="r" :value="r">{{ lib }}</option>
              </select>
              <button v-if="m.id !== etat?.moi.id" type="button" class="ed-btn ed-btn--clair" title="Retirer de l’équipe" @click="retirer(m)">✕</button>
            </div>
          </li>
          <li v-for="i in equipe.invitations" :key="i.id" class="ed-annulee">
            <div><strong>{{ i.email }}</strong><span>Invitation envoyée · {{ ROLES[i.role] }}</span></div>
            <button type="button" class="ed-btn ed-btn--clair" @click="annulerInvitation(i)">Annuler</button>
          </li>
        </ul>
        <form class="ed-inviter" @submit.prevent="inviter">
          <span class="ed-etiquette">Inviter quelqu’un</span>
          <div class="ed-ligne">
            <input v-model="invitation.email" type="email" required placeholder="adresse e-mail" aria-label="Adresse e-mail">
            <select v-model="invitation.role" class="ed-select" aria-label="Rôle">
              <option v-for="(lib, r) in ROLES" :key="r" :value="r">{{ lib }}</option>
            </select>
            <button type="submit" class="ed-btn ed-btn--publier">Inviter</button>
          </div>
        </form>
        <div v-if="lienInvitation" class="ed-lien-invit">
          <p v-if="lienInvitation.ajoute"><strong>{{ lienInvitation.email }}</strong> avait déjà un compte Bifrost : la personne fait maintenant partie de l’équipe{{ lienInvitation.envoye ? ' et a reçu un e-mail' : '' }}. Elle se connecte avec son mot de passe habituel :</p>
          <p v-else-if="lienInvitation.envoye">Un e-mail est parti pour <strong>{{ lienInvitation.email }}</strong>. Vous pouvez aussi lui transmettre ce lien (valable 7 jours) :</p>
          <p v-else>Envoyez ce lien à <strong>{{ lienInvitation.email }}</strong> (valable 7 jours) :</p>
          <div class="ed-ligne">
            <input :value="lienInvitation.lien" readonly aria-label="Lien d’invitation" @focus="($event.target as HTMLInputElement).select()">
            <button type="button" class="ed-btn ed-btn--clair" @click="copier(lienInvitation.lien)">Copier</button>
          </div>
        </div>
        <div class="ed-boutons"><button type="button" class="ed-btn ed-btn--clair" @click="equipe = null">Fermer</button></div>
      </div>
    </div>

    <!-- Confirmation -->
    <div v-if="confirmation" class="ed-fond" @click.self="confirmation = null">
      <div class="ed-fenetre ed-fenetre--petite">
        <p>{{ confirmation.texte }}</p>
        <div class="ed-boutons">
          <button type="button" class="ed-btn ed-btn--clair" @click="confirmation = null">Annuler</button>
          <button type="button" class="ed-btn ed-btn--danger" @click="confirmer">Confirmer</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.ed { position: fixed; inset: 0; display: flex; flex-direction: column; background: var(--bf-fond); color: var(--bf-texte); }
.ed-barre { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 10px 16px; background: linear-gradient(90deg, rgba(139, 92, 246, .10), rgba(224, 122, 74, .06)), var(--bf-surface); backdrop-filter: blur(18px); border-bottom: 1px solid var(--bf-bord); }
.ed-gauche { display: flex; align-items: center; gap: 12px; min-width: 0; }
.ed-logo { width: 38px; height: 38px; flex: none; border-radius: 11px; display: grid; place-items: center; font-size: 20px; color: #fff; background: var(--bf-degrade); box-shadow: 0 6px 18px rgba(139, 92, 246, .3); }
.ed-titre { display: flex; flex-direction: column; min-width: 0; }
.ed-titre strong { font-size: 15px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.ed-pages { background: transparent; color: var(--bf-texte); border: 0; padding: 0; font: inherit; font-size: 13px; cursor: pointer; max-width: 220px; }
.ed-pages option, .ed-sites option { color: var(--bf-texte); background: var(--bf-fond); }
.ed-actions { display: flex; align-items: center; gap: 8px; }
.ed-btn { border: 0; border-radius: 999px; padding: 10px 16px; font: inherit; font-size: 14px; font-weight: 600; cursor: pointer; white-space: nowrap; }
.ed-btn:disabled { opacity: .5; cursor: default; }
.ed-btn--clair { background: var(--bf-verre-fort); color: var(--bf-texte); box-shadow: inset 0 0 0 1px var(--bf-bord); }
.ed-btn--clair:hover { background: var(--bf-survol); }
.ed-btn--icone { background: var(--bf-verre); box-shadow: inset 0 0 0 1px var(--bf-bord); padding: 10px 12px; }
.ed-btn--icone[aria-pressed='true'] { background: rgba(224, 122, 74, .35); }
.ed-btn--publier { background: var(--bf-degrade); color: #fff; box-shadow: 0 6px 18px rgba(139, 92, 246, .25); }
.ed-btn--publier:not(:disabled):hover { filter: brightness(1.1); }
.ed-btn--danger { background: #c0392b; color: #fff; }
.ed-aide { font-size: 13px; color: var(--bf-doux); background: var(--bf-surface-legere); padding: 8px 16px; display: flex; flex-wrap: wrap; gap: 6px 16px; align-items: center; border-bottom: 1px solid var(--bf-bord); }
.ed-lien { background: none; border: 0; padding: 0; color: var(--bf-accent); font: inherit; cursor: pointer; text-decoration: underline; }
.ed-scene { flex: 1; display: flex; justify-content: center; padding: 0; overflow: hidden; background: transparent; }
.ed-cadre { width: 100%; height: 100%; border: 0; background: #fff; transition: width .25s; }
.ed-scene--mobile { padding: 20px 0; }
.ed-scene--mobile .ed-cadre { width: 390px; border-radius: 24px; box-shadow: 0 0 0 10px #222, 0 20px 60px rgba(0, 0, 0, .5); }
.ed-toast { position: fixed; left: 50%; bottom: 24px; transform: translateX(-50%); background: var(--bf-surface); backdrop-filter: blur(16px); border: 1px solid var(--bf-bord); color: var(--bf-texte); padding: 12px 20px; border-radius: 999px; font-size: 14px; box-shadow: 0 10px 30px rgba(0, 0, 0, .35); cursor: pointer; z-index: 30; max-width: calc(100% - 32px); }
.ed-toast--erreur { background: #b91c1c; color: #fff; }
.ed-occupe { position: fixed; top: 70px; right: 16px; background: rgba(30, 41, 59, .95); padding: 8px 14px; border-radius: 999px; font-size: 13px; z-index: 30; }
.ed-fond { position: fixed; inset: 0; background: var(--bf-voile); backdrop-filter: blur(4px); display: grid; place-items: center; padding: 16px; z-index: 40; }
.ed-fenetre { width: 100%; max-width: 560px; max-height: calc(100vh - 32px); overflow: auto; background: var(--bf-surface); backdrop-filter: blur(20px); border: 1px solid var(--bf-bord); border-radius: 20px; box-shadow: 0 30px 80px rgba(0, 0, 0, .5); padding: 24px; display: grid; gap: 14px; }
.ed-fenetre--petite { max-width: 400px; }
.ed-fenetre h2 { margin: 0; font-size: 20px; font-weight: 700; }
.ed-fenetre label, .ed-etiquette { display: grid; gap: 6px; font-size: 14px; font-weight: 600; color: var(--bf-texte); }
.ed-fenetre input, .ed-fenetre textarea { background: var(--bf-champ); border: 1px solid var(--bf-bord-fort); border-radius: 10px; padding: 12px; color: var(--bf-texte); font: inherit; font-weight: 400; }
.ed-photos { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 6px; }
.ed-photos img { width: 84px; height: 84px; object-fit: cover; border-radius: 10px; }
.ed-ajout-photo { width: 84px; height: 84px; border-radius: 10px; border: 2px dashed var(--bf-bord-fort); display: grid !important; place-items: center; cursor: pointer; font-size: 13px; }
.ed-boutons { display: flex; justify-content: flex-end; gap: 8px; flex-wrap: wrap; }
.ed-histo { list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; }
.ed-histo li { display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 12px; border-radius: 12px; background: var(--bf-verre); }
.ed-histo span { display: block; font-size: 13px; color: var(--bf-doux); }
.ed-annulee { opacity: .55; }
.ed-sites { font: inherit; font-weight: 700; color: inherit; background: transparent; border: 1px solid transparent; border-radius: 8px; padding: 2px 4px; margin-left: -4px; cursor: pointer; max-width: 100%; }
.ed-sites:hover, .ed-sites:focus-visible { background: var(--bf-verre); border-color: var(--bf-bord-fort); }
.ed-attente { font-size: 13px; color: var(--bf-texte); background: var(--bf-verre); padding: 10px 14px; border-radius: 999px; }
.ed-note { margin: 0; font-size: 14px; color: var(--bf-doux); }
.ed-ligne { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.ed-ligne input { flex: 1 1 200px; min-width: 0; }
.ed-select { background: var(--bf-champ); border: 1px solid var(--bf-bord-fort); border-radius: 10px; padding: 10px; color: var(--bf-texte); font: inherit; }
.ed-select option { color: var(--bf-texte); background: var(--bf-fond); }
.ed-inviter { display: grid; gap: 8px; }
.ed-lien-invit { display: grid; gap: 8px; padding: 12px; border-radius: 12px; background: rgba(224, 122, 74, .12); font-size: 14px; }
.ed-lien-invit p { margin: 0; }
.ed-fondu-enter-active, .ed-fondu-leave-active { transition: opacity .2s; }
.ed-fondu-enter-from, .ed-fondu-leave-to { opacity: 0; }
@media (max-width: 720px) {
  .ed-barre { padding: 8px 10px; }
  .ed-btn { padding: 9px 12px; font-size: 13px; }
  .ed-aide { display: none; }
  .ed-btn--icone { display: none; }
}
</style>
