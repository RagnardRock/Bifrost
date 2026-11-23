<script setup lang="ts">
/**
 * Éditeur sur place : le vrai site dans un cadre, modifiable au clic.
 * Le script injecté dans l'aperçu (overlay.js) envoie les modifications ici ; on appelle l'API.
 */
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { editeurService, type EtatEditeur, type Publication, type BlocDev, type ThemeDev } from '@/services/editeur.service'
import { adresseSite } from '@/services/suivi.service'
import { comptesService, type MonSite } from '@/services/comptes.service'
import { useAuthStore } from '@/stores/auth.store'
import { useUIStore } from '@/stores/ui.store'
import InstallerAppli from '@/components/appli/InstallerAppli.vue'
import AideEditeur from '@/components/aide/AideEditeur.vue'
import VisiteGuidee, { type EtapeVisite } from '@/components/aide/VisiteGuidee.vue'
import PanneauDev, { type SelectionDev, type FlagPage, type AlerteDev, type OperationDev } from '@/components/editeur/PanneauDev.vue'

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
// largeur de l'aperçu : bureau (pleine largeur), tablette ou téléphone
type Apercu = 'bureau' | 'tablette' | 'telephone'
const apercu = ref<Apercu>('bureau')
const APERCUS: { id: Apercu; icone: string; titre: string }[] = [
  { id: 'bureau', icone: '🖥️', titre: 'Aperçu ordinateur' },
  { id: 'tablette', icone: '📋', titre: 'Aperçu tablette (820 px)' },
  { id: 'telephone', icone: '📱', titre: 'Aperçu téléphone (390 px)' },
]
// Sur téléphone, les boutons de la barre et les raccourcis passent dans un menu « ⋯ »
const menuMobile = ref(false)
function depuisMenu(action: () => unknown) { menuMobile.value = false; void action() }

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
  // L'appli installée rouvre ce site au démarrage
  try { localStorage.setItem('bf-dernier-site', etat.value.site.slug || etat.value.site.id) } catch { /* stockage indisponible */ }
  const slug = etat.value.site.slug
  if (slug && route.params.siteId !== slug) router.replace({ params: { siteId: slug }, query: route.query })
}
function recharger() {
  cadre.value?.contentWindow?.postMessage({ source: 'bifrost-parent', type: 'avant-rechargement' }, '*')
  setTimeout(() => (cle.value++), 30)
}

// ---------- mode dev (compte du développeur) ----------
const lireModeDev = () => { try { return localStorage.getItem('bf-mode-dev') === '1' } catch { return false } }
const modeDev = ref(lireModeDev())
const devActif = computed(() => !!etat.value?.moi.dev && modeDev.value)
const selectionDev = ref<SelectionDev | null>(null)
const flagsPage = ref<FlagPage[]>([])
const alertesPage = ref<AlerteDev[]>([])
// élément à resélectionner quand l'aperçu se recharge après une opération
let aReselectionner: number[] | null = null
function versCadre(msg: Record<string, unknown>) {
  // copie simple : les tableaux réactifs de Vue ne passent pas par postMessage
  cadre.value?.contentWindow?.postMessage(JSON.parse(JSON.stringify({ source: 'bifrost-parent', ...msg })), '*')
}
function basculerModeDev() {
  modeDev.value = !modeDev.value
  try { localStorage.setItem('bf-mode-dev', modeDev.value ? '1' : '0') } catch { /* stockage indisponible */ }
  if (!modeDev.value) selectionDev.value = null
  versCadre({ type: 'mode', dev: devActif.value })
}
// bibliothèque de sections (chargée au premier passage en mode dev)
const blocsDev = ref<BlocDev[]>([])
async function chargerBlocs() {
  if (!devActif.value || blocsDev.value.length) return
  try { blocsDev.value = await editeurService.blocs(siteId.value) } catch (err) { echec(err, 'Bibliothèque de sections indisponible.') }
}
watch(devActif, (v) => { if (v) void chargerBlocs() })
async function insererBloc(bloc: string, position: 'avant' | 'apres' | 'dedans', cible: { chemin: number[]; balises: string[] } | null) {
  occupe.value = true
  try {
    const r = await editeurService.insererBloc(siteId.value, { page: page.value, bloc, position, ...(cible ?? {}) })
    aReselectionner = r.chemin
    await rafraichirEtat()
    recharger()
    informer('Section ajoutée au brouillon')
  } catch (err) {
    echec(err)
  } finally {
    occupe.value = false
  }
}
function insererDepuisPanneau(bloc: string) {
  const sel = selectionDev.value
  void insererBloc(bloc, sel ? 'apres' : 'dedans', sel ? { chemin: sel.chemin, balises: sel.balises } : null)
}
async function enregistrerBloc(nom: string) {
  const sel = selectionDev.value
  if (!sel) return
  try {
    const b = await editeurService.enregistrerBloc(siteId.value, { page: page.value, chemin: sel.chemin, balises: sel.balises, nom })
    blocsDev.value = [...blocsDev.value, b]
    informer(`Bloc « ${b.nom} » enregistré`)
  } catch (err) { echec(err) }
}
function supprimerBloc(b: BlocDev) {
  confirmation.value = {
    texte: `Supprimer le bloc « ${b.nom} » ? Les pages où il a déjà été ajouté ne changent pas.`,
    action: async () => {
      await editeurService.supprimerBloc(siteId.value, b.id)
      blocsDev.value = blocsDev.value.filter((x) => x.id !== b.id)
    },
  }
}
// thème : variables CSS du site et des sections Bifrost
const themeDev = ref<ThemeDev | null>(null)
async function chargerTheme() {
  try { themeDev.value = await editeurService.theme(siteId.value) } catch (err) { echec(err, 'Thème indisponible.') }
}
async function enregistrerTheme(modifs: { fichier: string; nom: string; valeur: string }[]) {
  occupe.value = true
  try {
    themeDev.value = await editeurService.enregistrerTheme(siteId.value, modifs)
    await rafraichirEtat()
    recharger()
    informer('Thème enregistré dans le brouillon')
  } catch (err) {
    echec(err)
  } finally {
    occupe.value = false
  }
}
// pages du site : créer, renommer, supprimer (le menu suit)
async function actionPage(faire: () => Promise<string | void>) {
  occupe.value = true
  try {
    const texte = await faire()
    await rafraichirEtat()
    recharger()
    if (texte) informer(texte)
  } catch (err) {
    echec(err)
  } finally {
    occupe.value = false
  }
}
const pluriel = (n: number, mot: string) => `${n} ${mot}${n > 1 ? 's' : ''}`
function creerPage(b: { titre: string; chemin: string; depuis: string; menu: boolean }) {
  void actionPage(async () => {
    const r = await editeurService.creerPage(siteId.value, b)
    page.value = r.page
    selectionDev.value = null
    return `Page ${r.page} créée${r.menus ? `, ajoutée au menu de ${pluriel(r.menus, 'page')}` : ''}`
  })
}
function renommerPage(ancienne: string, nouveau: string) {
  void actionPage(async () => {
    const r = await editeurService.renommerPage(siteId.value, ancienne, nouveau)
    if (page.value === ancienne) page.value = r.page
    return `Page renommée en ${r.page}${r.liens ? ` (${pluriel(r.liens, 'lien')} mis à jour)` : ''}`
  })
}
function supprimerPage(p: string) {
  confirmation.value = {
    texte: `Supprimer la page ${p} ? Elle sera retirée du menu. Le site en ligne ne change qu’à la prochaine publication.`,
    action: async () => {
      await actionPage(async () => {
        const r = await editeurService.supprimerPage(siteId.value, p)
        if (page.value === p) { page.value = 'index.html'; selectionDev.value = null }
        return r.liensRestants.length ? `Page supprimée. Des liens y mènent encore depuis : ${r.liensRestants.slice(0, 4).join(', ')}${r.liensRestants.length > 4 ? '…' : ''}` : 'Page supprimée et retirée du menu'
      })
    },
  }
}
function ouvrirPage(p: string) { if (p !== page.value) { page.value = p; selectionDev.value = null; cle.value++ } }
function selectionnerDev(chemin: number[]) { versCadre({ type: 'selectionner', chemin, defiler: true }) }
async function operationDev(chemin: number[], balises: string[], operation: OperationDev, confirmerTexte?: string) {
  const faire = async () => {
    occupe.value = true
    try {
      const r = await editeurService.dev(siteId.value, { page: page.value, chemin, balises, operation })
      aReselectionner = r.chemin
      if (!r.chemin) selectionDev.value = null
      await rafraichirEtat()
      recharger()
      informer('Enregistré dans le brouillon')
    } finally {
      occupe.value = false
    }
  }
  if (confirmerTexte) confirmation.value = { texte: confirmerTexte, action: faire }
  else await faire().catch((err) => echec(err))
}
function depuisPanneau(o: OperationDev, confirmerTexte?: string) {
  const sel = selectionDev.value
  if (sel) void operationDev(sel.chemin, sel.balises, o, confirmerTexte)
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
      if (etat.value?.moi.dev) {
        versCadre({ type: 'mode', dev: devActif.value })
        if (devActif.value && aReselectionner) versCadre({ type: 'selectionner', chemin: aReselectionner })
        else selectionDev.value = null
        aReselectionner = null
      }
    } else if (m.type === 'selection') {
      selectionDev.value = m.chemin ? m as SelectionDev : null
    } else if (m.type === 'inserer-bloc') {
      if (!devActif.value) return
      await insererBloc(m.bloc, m.position, m.chemin ? { chemin: m.chemin, balises: m.balises } : null)
    } else if (m.type === 'flags-page') {
      flagsPage.value = m.flags
      alertesPage.value = m.alertes
    } else if (m.type === 'dev') {
      if (!devActif.value) return
      await operationDev(m.chemin, m.balises, m.operation, m.demanderConfirmation ? 'Supprimer cet élément et tout ce qu’il contient ?' : undefined)
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

// ---------- espace client (ses sites, messages, compte) ; le dev va directement à la gestion du site ----------
const lienMonSite = computed(() => {
  const nonLus = responsable.value && !!etat.value?.messagesNonLus
  if (etat.value?.moi.dev || nonLus) return { name: 'mon-site', params: { siteId: etat.value?.site.slug || siteId.value }, query: nonLus ? { onglet: 'messages' } : {} }
  return { name: 'espace' }
})
const nomEspace = computed(() => (etat.value?.moi.dev ? 'Gérer' : 'Mon espace'))

// ---------- aide et visite guidée ----------
const aideOuverte = ref(false)
const visite = ref<EtapeVisite[] | null>(null)
const CLE_VISITE = 'bf-visite-vue'
const etapesVisite = computed<EtapeVisite[]>(() => [
  { cibles: ['[data-aide="apercu"]'], titre: 'Voici votre site', texte: 'Cliquez sur un texte pour le modifier, sur une photo pour la changer. C’est tout !' },
  { cibles: ['[data-aide="actualite"]', '[data-aide="menu"]'], titre: 'Une nouvelle à partager ?', texte: '« + Actualité » ajoute une actualité, avec ses photos.' },
  responsable.value
    ? { cibles: ['[data-aide="publier"]', '[data-aide="menu"]'], titre: 'Rien ne change avant « Publier »', texte: 'Vos modifications restent en brouillon. « Publier » les met en ligne, et l’horloge 🕘 permet de revenir en arrière.' }
    : { cibles: ['[data-aide="attente"]', '[data-aide="menu"]'], titre: 'Vos changements attendent ici', texte: 'Un responsable du site les relit et les publie. Le bouton « ? » rouvre l’aide à tout moment.' },
])
function finVisite() {
  visite.value = null
  try { localStorage.setItem(CLE_VISITE, '1') } catch { /* stockage indisponible */ }
}
/** Première visite d'un client (pas du dev) : la visite guidée se lance une fois. */
function proposerVisite() {
  if (!etat.value || etat.value.moi.dev) return
  let vue = false
  try { vue = localStorage.getItem(CLE_VISITE) === '1' } catch { /* stockage indisponible */ }
  if (!vue) setTimeout(() => { if (!visite.value && !aideOuverte.value) visite.value = etapesVisite.value }, 800)
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
function annulerPublication(p: Publication, i: number) {
  const suivantes = historique.value?.slice(0, i).filter((x) => !x.annulee).length ?? 0
  confirmation.value = {
    texte: suivantes
      ? `Remettre le site tel qu’il était avant cette publication ? Les ${suivantes + 1} dernières publications seront annulées.`
      : 'Remettre le site tel qu’il était avant cette publication ?',
    action: async () => {
      await editeurService.annuler(siteId.value, p.id)
      await rafraichirEtat()
      historique.value = await editeurService.publications(siteId.value)
      recharger()
      informer(suivantes ? `${suivantes + 1} publications annulées.` : 'Publication annulée.')
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
    proposerVisite()
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
        <button v-if="etat?.moi.dev" class="ed-btn ed-btn--icone ed-btn--dev" type="button" :aria-pressed="devActif" :title="devActif ? 'Revenir au mode client' : 'Mode dev : sélectionner n’importe quel élément, poser des flags'" @click="basculerModeDev">🛠️<span class="ed-btn-texte">{{ devActif ? 'Mode dev' : 'Dev' }}</span></button>
        <button class="ed-btn ed-btn--clair" type="button" data-aide="actualite" @click="ouvrirNouvelle">+ Actualité</button>
        <div class="ed-apercus" role="group" aria-label="Largeur de l’aperçu">
          <button v-for="a in APERCUS" :key="a.id" type="button" class="ed-apercu" :aria-pressed="apercu === a.id" :title="a.titre" :aria-label="a.titre" @click="apercu = a.id">{{ a.icone }}</button>
        </div>
        <router-link :to="lienMonSite" class="ed-btn ed-btn--clair ed-btn--badge ed-mon-site" data-aide="espace" :title="responsable && etat?.messagesNonLus ? `Messages, équipe, réglages (${etat.messagesNonLus} message${etat.messagesNonLus > 1 ? 's' : ''} non lu${etat.messagesNonLus > 1 ? 's' : ''})` : etat?.moi.dev ? 'Messages, équipe, réglages' : 'Mes sites, messages, mon compte'">
          {{ nomEspace }}<span v-if="responsable && etat?.messagesNonLus" class="ed-badge">{{ etat.messagesNonLus > 99 ? '99+' : etat.messagesNonLus }}</span>
        </router-link>
        <template v-if="responsable">
          <button class="ed-btn ed-btn--icone" type="button" title="Historique des publications" data-aide="historique" @click="ouvrirHistorique">🕘</button>
          <button class="ed-btn ed-btn--publier" type="button" data-aide="publier" :disabled="!nbModifs || occupe" :title="detailModifs" @click="publier">
            {{ nbModifs ? `Publier (${nbModifs})` : 'À jour' }}
          </button>
        </template>
        <span v-else-if="etat" class="ed-attente" data-aide="attente" :title="nbModifs ? `${detailModifs}\n\nUn responsable du site publiera vos modifications.` : ''">
          {{ nbModifs ? `${modifsTexte(nbModifs)} en attente de publication` : 'Tout est publié' }}
        </span>
        <button class="ed-btn ed-btn--icone ed-btn--aide" type="button" title="Aide" aria-label="Aide" data-aide="aide" @click="aideOuverte = true">?</button>
        <button class="ed-btn ed-btn--icone ed-btn--plus" type="button" aria-label="Plus d’actions" data-aide="menu" :aria-expanded="menuMobile" @click="menuMobile = true">
          ⋯<span v-if="responsable && etat?.messagesNonLus" class="ed-badge">{{ etat.messagesNonLus > 99 ? '99+' : etat.messagesNonLus }}</span>
        </button>
      </div>
    </header>

    <div class="ed-aide">
      <p v-if="devActif" class="ed-astuce"><span aria-hidden="true">🛠️</span> Mode dev : cliquez sur n’importe quel élément pour le sélectionner, double-cliquez pour modifier son texte. Échap remonte au parent.</p>
      <p v-else class="ed-astuce"><span aria-hidden="true">✎</span> Cliquez sur un texte pour le modifier, sur une photo pour la changer. Survolez une actualité pour la déplacer ou la supprimer.</p>
      <div class="ed-raccourcis">
        <button v-if="nbModifs && responsable" type="button" class="ed-pastille ed-pastille--danger" @click="abandonner">Effacer mes modifications</button>
        <a :href="adresseSite(etat?.site ?? { id: siteId })" target="_blank" rel="noopener" class="ed-pastille">Voir le site <span aria-hidden="true">↗</span></a>
        <router-link v-if="etat?.moi.dev" :to="`/admin/sites/${etat?.site.slug || siteId}`" class="ed-pastille">Fiche du site</router-link>
        <button type="button" class="ed-pastille" :title="`Thème : ${ui.theme === 'system' ? 'comme l’appareil' : ui.theme === 'dark' ? 'sombre' : 'clair'}`" :aria-label="`Changer de thème (actuel : ${ui.theme === 'system' ? 'auto' : ui.theme === 'dark' ? 'sombre' : 'clair'})`" @click="ui.basculerTheme()">{{ ui.theme === 'dark' ? '🌙' : ui.theme === 'light' ? '☀️' : '💻' }}</button>
        <button type="button" class="ed-pastille" @click="deconnexion">Se déconnecter</button>
      </div>
    </div>

    <div class="ed-zone">
      <main class="ed-scene" :class="{ 'ed-scene--mobile': apercu === 'telephone', 'ed-scene--tablette': apercu === 'tablette' }">
        <iframe v-if="etat" :key="cle" ref="cadre" :src="src" title="Votre site" class="ed-cadre" data-aide="apercu" />
      </main>
      <PanneauDev v-if="devActif" :selection="selectionDev" :flags="flagsPage" :alertes="alertesPage" :occupe="occupe" :blocs="blocsDev"
        @operation="depuisPanneau" @selectionner="selectionnerDev" @fermer="basculerModeDev"
        @glisser="(id) => versCadre({ type: 'glisser', bloc: id })" @fin-glisser="versCadre({ type: 'fin-glisser' })"
        @inserer="insererDepuisPanneau" @enregistrer="enregistrerBloc" @supprimer-bloc="supprimerBloc"
        :theme="themeDev" :pages="etat?.pages ?? []" :page="page" @page-ouvrir="ouvrirPage" @page-creer="creerPage" @page-renommer="renommerPage" @page-supprimer="supprimerPage"
        @theme-charger="chargerTheme" @theme-apercu="(nom, valeur) => versCadre({ type: 'theme', nom, valeur })" @theme-enregistrer="enregistrerTheme" />
    </div>

    <input ref="choixImage" type="file" accept="image/*" hidden @change="surImage">

    <transition name="ed-fondu">
      <div v-if="message || erreur" class="ed-toast" :class="{ 'ed-toast--erreur': erreur }" role="status" @click="erreur = ''">
        {{ erreur || message }}
      </div>
    </transition>
    <div v-if="occupe" class="ed-occupe" aria-live="polite">Un instant…</div>

    <!-- Menu « ⋯ » (téléphone) -->
    <div v-if="menuMobile" class="ed-fond ed-fond--bas" @click.self="menuMobile = false">
      <nav class="ed-menu" aria-label="Actions">
        <p v-if="!responsable && etat" class="ed-menu-info">{{ nbModifs ? `${modifsTexte(nbModifs)} en attente : un responsable du site les publiera.` : 'Tout est publié.' }}</p>
        <router-link :to="lienMonSite"><span aria-hidden="true">🏠</span>{{ nomEspace }}<small>{{ etat?.moi.dev ? 'Messages, équipe, réglages' : 'Mes sites, messages, mon compte' }}</small><b v-if="responsable && etat?.messagesNonLus" class="ed-badge ed-badge--ligne">{{ etat.messagesNonLus }}</b></router-link>
        <template v-if="responsable">
          <button type="button" @click="depuisMenu(ouvrirHistorique)"><span aria-hidden="true">🕘</span>Historique des publications</button>
          <button v-if="nbModifs" type="button" class="ed-rouge" @click="depuisMenu(abandonner)"><span aria-hidden="true">🗑️</span>Effacer mes modifications</button>
        </template>
        <a :href="adresseSite(etat?.site ?? { id: siteId })" target="_blank" rel="noopener" @click="menuMobile = false"><span aria-hidden="true">↗</span>Voir le site</a>
        <router-link v-if="etat?.moi.dev" :to="`/admin/sites/${etat?.site.slug || siteId}`"><span aria-hidden="true">🛠️</span>Fiche du site</router-link>
        <InstallerAppli compact class="ed-menu-appli" @fait="menuMobile = false" />
        <button type="button" @click="menuMobile = false; aideOuverte = true"><span aria-hidden="true">❓</span>Aide</button>
        <button type="button" @click="ui.basculerTheme()"><span aria-hidden="true">{{ ui.theme === 'dark' ? '🌙' : ui.theme === 'light' ? '☀️' : '💻' }}</span>Thème : {{ ui.theme === 'system' ? 'comme le téléphone' : ui.theme === 'dark' ? 'sombre' : 'clair' }}</button>
        <button type="button" @click="depuisMenu(deconnexion)"><span aria-hidden="true">🚪</span>Se déconnecter</button>
        <button type="button" class="ed-menu-fermer" @click="menuMobile = false">Fermer</button>
      </nav>
    </div>

    <!-- Aide et visite guidée -->
    <AideEditeur v-if="aideOuverte" :responsable="responsable" @fermer="aideOuverte = false"
      @montrer="(e) => { aideOuverte = false; visite = [e] }" @visite="aideOuverte = false; visite = etapesVisite" />
    <VisiteGuidee v-if="visite" :etapes="visite" @fin="finVisite" />

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
            <button v-if="!p.annulee" type="button" class="ed-btn ed-btn--clair" @click="annulerPublication(p, i)">Revenir avant</button>
          </li>
        </ul>
        <div class="ed-boutons"><button type="button" class="ed-btn ed-btn--clair" @click="historique = null">Fermer</button></div>
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
.ed-barre { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 10px 16px; background: var(--bf-surface); backdrop-filter: blur(18px); border-bottom: 1px solid var(--bf-bord); }
.ed-gauche { display: flex; align-items: center; gap: 12px; min-width: 0; }
.ed-logo { width: 38px; height: 38px; flex: none; border-radius: 11px; display: grid; place-items: center; font-size: 20px; color: #fff; background: var(--bf-degrade); font-family: 'Noto Sans Runic', 'Segoe UI Historic', sans-serif; }
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
.ed-aide { display: flex; align-items: center; justify-content: space-between; gap: 8px 20px; flex-wrap: wrap; padding: 6px 10px 6px 18px; font-size: 13px; color: var(--bf-doux); background: var(--bf-surface-legere); border-bottom: 1px solid var(--bf-bord); }
.ed-astuce { margin: 0; min-width: 0; }
.ed-astuce span { color: var(--bf-fort); margin-right: 4px; }
.ed-raccourcis { display: flex; align-items: center; gap: 2px; flex-wrap: wrap; }
.ed-pastille { display: inline-flex; align-items: center; gap: 6px; padding: 5px 12px; border-radius: 999px; border: 0; background: none; color: var(--bf-texte); font: inherit; font-size: 13px; font-weight: 500; text-decoration: none; cursor: pointer; white-space: nowrap; transition: background .2s, color .2s; }
.ed-pastille:hover { background: var(--bf-verre-fort); color: var(--bf-fort); }
.ed-pastille--danger { color: var(--bf-danger); }
.ed-pastille--danger:hover { background: rgba(248, 113, 113, .12); color: var(--bf-danger); }
.ed-zone { flex: 1; display: flex; min-height: 0; }
.ed-btn--dev { display: inline-flex; align-items: center; gap: 6px; }
.ed-btn--dev[aria-pressed='true'] { background: rgba(139, 92, 246, .35); color: var(--bf-fort); }
.ed-scene { flex: 1; min-width: 0; display: flex; justify-content: center; padding: 0; overflow: hidden; background: transparent; }
.ed-cadre { width: 100%; height: 100%; border: 0; background: #fff; transition: width .25s; }
.ed-scene--mobile, .ed-scene--tablette { padding: 20px 0; overflow: auto; }
.ed-scene--tablette .ed-cadre { width: 820px; max-width: calc(100% - 32px); border-radius: 20px; box-shadow: 0 0 0 10px #222, 0 20px 60px rgba(0, 0, 0, .5); }
.ed-apercus { display: flex; gap: 2px; padding: 3px; border-radius: 999px; background: var(--bf-verre); box-shadow: inset 0 0 0 1px var(--bf-bord); }
.ed-apercu { border: 0; background: none; border-radius: 999px; padding: 6px 9px; font-size: 15px; cursor: pointer; line-height: 1; opacity: .6; }
.ed-apercu:hover { opacity: 1; }
.ed-apercu[aria-pressed='true'] { background: var(--bf-verre-fort); opacity: 1; box-shadow: 0 1px 3px rgba(0, 0, 0, .2); }
.ed-scene--mobile .ed-cadre { width: 390px; border-radius: 24px; box-shadow: 0 0 0 10px #222, 0 20px 60px rgba(0, 0, 0, .5); }
.ed-toast { position: fixed; left: 50%; bottom: 24px; transform: translateX(-50%); background: var(--bf-surface); backdrop-filter: blur(16px); border: 1px solid var(--bf-bord); color: var(--bf-texte); padding: 12px 20px; border-radius: 999px; font-size: 14px; box-shadow: 0 10px 30px rgba(0, 0, 0, .35); cursor: pointer; z-index: 30; max-width: calc(100% - 32px); }
.ed-toast--erreur { background: #b91c1c; color: #fff; }
.ed-occupe { position: fixed; top: 70px; right: 16px; background: rgba(30, 41, 59, .95); padding: 8px 14px; border-radius: 999px; font-size: 13px; z-index: 30; }
.ed-fond { position: fixed; inset: 0; background: var(--bf-voile); backdrop-filter: blur(4px); display: grid; place-items: center; padding: 16px; z-index: 40; }
.ed-fenetre { width: 100%; max-width: 560px; max-height: calc(100vh - 32px); overflow: auto; background: var(--bf-surface); backdrop-filter: blur(20px); border: 1px solid var(--bf-bord); border-radius: 20px; box-shadow: 0 30px 80px rgba(0, 0, 0, .5); padding: 24px; display: grid; gap: 14px; }
.ed-fenetre--petite { max-width: 400px; }
.ed-fenetre--large { max-width: 680px; }
.ed-btn--badge { position: relative; }
.ed-btn--aide { font-weight: 800; min-width: 40px; }
.ed-btn--plus { display: none; position: relative; font-weight: 800; letter-spacing: 1px; }
.ed-fond--bas { place-items: end center; padding: 0; }
.ed-menu { width: 100%; max-width: 520px; display: grid; gap: 2px; padding: 10px 10px calc(10px + env(safe-area-inset-bottom)); background: var(--bf-surface); backdrop-filter: blur(20px); border: 1px solid var(--bf-bord); border-bottom: 0; border-radius: 20px 20px 0 0; box-shadow: 0 -20px 60px rgba(0, 0, 0, .4); }
.ed-menu > a, .ed-menu > button { display: flex; align-items: center; gap: 12px; width: 100%; min-height: 50px; padding: 0 14px; border: 0; border-radius: 12px; background: none; color: var(--bf-texte); font: inherit; font-size: 15px; font-weight: 500; text-align: left; text-decoration: none; cursor: pointer; }
.ed-menu > a:hover, .ed-menu > button:hover { background: var(--bf-verre-fort); }
.ed-menu span { width: 24px; text-align: center; }
.ed-menu .ed-menu-fermer { justify-content: center; margin-top: 6px; background: var(--bf-verre); font-weight: 600; }
.ed-menu .ed-badge--ligne { position: static; margin-left: auto; }
.ed-menu > a small { margin-left: -4px; font-size: 13px; font-weight: 400; color: var(--bf-doux); }
.ed-mon-site { position: relative; text-decoration: none; }
.ed-menu-info { margin: 4px 14px 8px; font-size: 14px; color: var(--bf-doux); }
.ed-badge { position: absolute; top: -4px; right: -4px; min-width: 18px; height: 18px; padding: 0 5px; border-radius: 999px; background: var(--bf-accent, #e07a4a); color: #fff; font-size: 11px; font-weight: 700; line-height: 18px; text-align: center; }
.ed-rouge { color: var(--bf-danger); }
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
.ed-fondu-enter-active, .ed-fondu-leave-active { transition: opacity .2s; }
.ed-fondu-enter-from, .ed-fondu-leave-to { opacity: 0; }
@media (max-width: 720px) {
  .ed-barre { padding: 8px 10px; }
  .ed-btn { padding: 9px 12px; font-size: 13px; }
  .ed-aide { display: none; }
  .ed-btn--icone, .ed-mon-site, .ed-apercus { display: none; }
  .ed-btn--icone.ed-btn--plus { display: inline-block; }
  .ed-attente { display: none; }
}
</style>
