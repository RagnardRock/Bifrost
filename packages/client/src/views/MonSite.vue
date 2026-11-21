<script setup lang="ts">
/**
 * Espace « Mon site » : ce qui n'est pas la page elle-même.
 * Messages reçus, équipe, réglages du site (responsables) et mon compte (tout le monde).
 */
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { editeurService, type EtatEditeur, type Message, type Membre, type Invitation, type RoleSite, type Reglages } from '@/services/editeur.service'
import { comptesService } from '@/services/comptes.service'
import DoubleAuth from '@/components/compte/DoubleAuth.vue'
import InstallerAppli from '@/components/appli/InstallerAppli.vue'
import { adresseSite } from '@/services/suivi.service'
import { useAuthStore } from '@/stores/auth.store'

type Onglet = 'messages' | 'equipe' | 'reglages' | 'compte'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

const etat = ref<EtatEditeur | null>(null)
const siteId = computed(() => etat.value?.site.id ?? (route.params.siteId as string))
const cleSite = computed(() => etat.value?.site.slug || siteId.value)
const responsable = computed(() => etat.value?.moi.role === 'responsable')
const erreur = ref('')
const info = ref('')

const ONGLETS: { id: Onglet; nom: string; icone: string; responsable: boolean }[] = [
  { id: 'messages', nom: 'Messages', icone: '📨', responsable: true },
  { id: 'equipe', nom: 'Équipe', icone: '👥', responsable: true },
  { id: 'reglages', nom: 'Réglages', icone: '⚙️', responsable: true },
  { id: 'compte', nom: 'Mon compte', icone: '👤', responsable: false },
]
const onglets = computed(() => ONGLETS.filter((o) => !o.responsable || responsable.value))
const onglet = computed<Onglet>(() => {
  const voulu = route.query.onglet as Onglet
  return onglets.value.some((o) => o.id === voulu) ? voulu : onglets.value[0]?.id ?? 'compte'
})
const aller = (o: Onglet) => router.replace({ query: { onglet: o } })

let minuteur: number | undefined
function informer(t: string) {
  info.value = t
  clearTimeout(minuteur)
  minuteur = window.setTimeout(() => (info.value = ''), 3500)
}
function echec(e: any, defaut: string) {
  erreur.value = e?.response?.data?.error?.message || defaut
}

async function chargerEtat() {
  etat.value = await editeurService.etat(siteId.value)
  if (etat.value.site.slug && route.params.siteId !== etat.value.site.slug) router.replace({ params: { siteId: etat.value.site.slug }, query: route.query })
}

// ---------- messages ----------
const messages = ref<Message[] | null>(null)
const ouvert = ref<string | null>(null)
const titreMessage = (m: Message) => m.champs.find((c) => c.valeur && c.valeur !== m.email)?.valeur.slice(0, 80) || m.email || 'Message'
const apercuMessage = (m: Message) => m.champs.filter((c) => c.valeur && c.valeur !== m.email && c.valeur !== titreMessage(m)).map((c) => c.valeur).join(' · ').slice(0, 140)
const repondre = (m: Message) => `mailto:${m.email}?subject=${encodeURIComponent(`Re : votre message sur ${etat.value?.site.name ?? 'notre site'}`)}`
const dateLisible = (d: string) => new Date(d).toLocaleString('fr-FR', { dateStyle: 'long', timeStyle: 'short' })

async function lireMessage(m: Message) {
  ouvert.value = ouvert.value === m.id ? null : m.id
  if (m.lu) return
  m.lu = true
  try { await editeurService.marquerLu(siteId.value, m.id, true); await chargerEtat() } catch { m.lu = false }
}
async function marquerNonLu(m: Message) {
  try { await editeurService.marquerLu(siteId.value, m.id, false); m.lu = false; ouvert.value = null; await chargerEtat() } catch (e) { echec(e, 'Action impossible.') }
}
const confirmation = ref<{ texte: string; action: () => Promise<void> } | null>(null)
function supprimerMessage(m: Message) {
  confirmation.value = {
    texte: 'Supprimer ce message ? Il ne pourra pas être récupéré.',
    action: async () => {
      await editeurService.supprimerMessage(siteId.value, m.id)
      messages.value = (messages.value ?? []).filter((x) => x.id !== m.id)
      await chargerEtat()
    },
  }
}

// ---------- équipe ----------
const equipe = ref<{ membres: Membre[]; invitations: Invitation[] } | null>(null)
const invitation = ref<{ email: string; role: RoleSite }>({ email: '', role: 'redacteur' })
const lienInvitation = ref<{ email: string; lien: string; envoye: boolean; ajoute: boolean } | null>(null)
const ROLES: Record<RoleSite, string> = { responsable: 'Responsable', redacteur: 'Rédacteur' }
async function inviter() {
  const email = invitation.value.email.trim()
  if (!email) return
  try {
    const r = await editeurService.inviter(siteId.value, email, invitation.value.role)
    lienInvitation.value = { email, ...r }
    invitation.value.email = ''
    equipe.value = await editeurService.equipe(siteId.value)
  } catch (e) { echec(e, 'L’invitation n’a pas pu être créée.') }
}
async function copier(t: string) {
  try { await navigator.clipboard.writeText(t); informer('Lien copié') } catch { informer('Sélectionnez le lien pour le copier') }
}
async function changerRole(m: Membre, role: RoleSite) {
  try { await editeurService.changerRole(siteId.value, m.id, role); m.role = role; informer('Rôle modifié') } catch (e) { echec(e, 'Rôle non modifié.'); equipe.value = await editeurService.equipe(siteId.value) }
}
function retirer(m: Membre) {
  confirmation.value = {
    texte: `Retirer ${m.email} de l’équipe ? Cette personne ne pourra plus modifier le site.`,
    action: async () => { await editeurService.retirer(siteId.value, m.id); equipe.value = await editeurService.equipe(siteId.value) },
  }
}
async function annulerInvitation(i: Invitation) {
  try { await editeurService.annulerInvitation(siteId.value, i.id); equipe.value = await editeurService.equipe(siteId.value) } catch (e) { echec(e, 'Action impossible.') }
}

// ---------- réglages ----------
const reglages = ref<Reglages | null>(null)
const formReglages = ref({ nom: '', emailMessages: '' })
async function enregistrerReglages() {
  try {
    reglages.value = await editeurService.modifierReglages(siteId.value, { nom: formReglages.value.nom, emailMessages: formReglages.value.emailMessages })
    formReglages.value = { nom: reglages.value.name, emailMessages: reglages.value.emailMessages || '' }
    await chargerEtat()
    informer('Réglages enregistrés')
  } catch (e) { echec(e, 'Réglages non enregistrés.') }
}
const adressePublique = computed(() => (etat.value ? new URL(adresseSite(etat.value.site), window.location.origin).toString() : ''))

// ---------- mon compte ----------
const mdp = ref({ actuel: '', nouveau: '', confirmation: '' })
async function changerMotDePasse() {
  if (mdp.value.nouveau !== mdp.value.confirmation) { erreur.value = 'Les deux nouveaux mots de passe ne sont pas identiques.'; return }
  try {
    await comptesService.changerMotDePasse(mdp.value.actuel, mdp.value.nouveau)
    mdp.value = { actuel: '', nouveau: '', confirmation: '' }
    informer('Mot de passe changé')
  } catch (e) { echec(e, 'Mot de passe non changé.') }
}
function deconnexion() {
  auth.logout?.()
  router.push('/login')
}

async function confirmer() {
  const c = confirmation.value
  confirmation.value = null
  if (!c) return
  try { await c.action() } catch (e) { echec(e, 'Action impossible.') }
}

async function chargerOnglet(o: Onglet) {
  erreur.value = ''
  try {
    if (o === 'messages') messages.value = await editeurService.messages(siteId.value)
    else if (o === 'equipe') { lienInvitation.value = null; equipe.value = await editeurService.equipe(siteId.value) }
    else if (o === 'reglages') {
      reglages.value = await editeurService.reglages(siteId.value)
      formReglages.value = { nom: reglages.value.name, emailMessages: reglages.value.emailMessages || '' }
    }
  } catch (e) { echec(e, 'Chargement impossible.') }
}
watch(onglet, (o) => { if (etat.value) void chargerOnglet(o) })

onMounted(async () => {
  try {
    await chargerEtat()
    await chargerOnglet(onglet.value)
  } catch (e) { echec(e, 'Impossible d’ouvrir cet espace.') }
})
</script>

<template>
  <div class="ms">
    <header class="ms-barre">
      <router-link :to="`/edition/${cleSite}`" class="ms-retour" aria-label="Retour à l’édition du site">←<span> Modifier le site</span></router-link>
      <div class="ms-titre">
        <strong>{{ etat?.site.name || 'Mon site' }}</strong>
        <a v-if="etat" :href="adresseSite(etat.site)" target="_blank" rel="noopener">Voir le site ↗</a>
      </div>
    </header>

    <nav class="ms-onglets" aria-label="Rubriques">
      <button v-for="o in onglets" :key="o.id" type="button" :aria-current="onglet === o.id ? 'page' : undefined" @click="aller(o.id)">
        <span aria-hidden="true">{{ o.icone }}</span>{{ o.nom }}
        <b v-if="o.id === 'messages' && etat?.messagesNonLus" class="ms-badge">{{ etat.messagesNonLus }}</b>
      </button>
    </nav>

    <main class="ms-contenu">
      <p v-if="erreur" class="ms-alerte" role="alert" @click="erreur = ''">{{ erreur }}</p>

      <!-- Messages -->
      <section v-if="onglet === 'messages'">
        <h1>Messages reçus</h1>
        <p class="ms-note">Les messages envoyés par le formulaire du site. Ils arrivent aussi par e-mail.</p>
        <p v-if="messages && !messages.length" class="ms-vide">Aucun message pour l’instant.</p>
        <ul class="ms-liste">
          <li v-for="m in messages ?? []" :key="m.id" :class="{ 'ms-non-lu': !m.lu }">
            <button type="button" class="ms-message-tete" :aria-expanded="ouvert === m.id" @click="lireMessage(m)">
              <span class="ms-point" aria-hidden="true" />
              <span class="ms-resume"><strong>{{ titreMessage(m) }}</strong><span>{{ apercuMessage(m) }}</span></span>
              <time :datetime="m.createdAt">{{ dateLisible(m.createdAt) }}</time>
            </button>
            <div v-if="ouvert === m.id" class="ms-message-corps">
              <dl>
                <template v-for="c in m.champs" :key="c.nom"><dt>{{ c.libelle }}</dt><dd>{{ c.valeur || '—' }}</dd></template>
              </dl>
              <div class="ms-ligne">
                <a v-if="m.email" :href="repondre(m)" class="ms-btn ms-btn--fort">Répondre</a>
                <button type="button" class="ms-btn" @click="marquerNonLu(m)">Marquer non lu</button>
                <button type="button" class="ms-btn ms-rouge" @click="supprimerMessage(m)">Supprimer</button>
              </div>
            </div>
          </li>
        </ul>
      </section>

      <!-- Équipe -->
      <section v-else-if="onglet === 'equipe'">
        <h1>Équipe du site</h1>
        <p class="ms-note">Les <strong>responsables</strong> publient et gèrent l’équipe. Les <strong>rédacteurs</strong> modifient le site ; un responsable publie ensuite.</p>
        <ul v-if="equipe" class="ms-liste">
          <li v-for="m in equipe.membres" :key="m.id" class="ms-ligne-membre">
            <div class="ms-resume"><strong>{{ m.email }}</strong><span v-if="m.id === etat?.moi.id">C’est vous</span></div>
            <div class="ms-ligne">
              <select :value="m.role" class="ms-champ" :disabled="m.id === etat?.moi.id" aria-label="Rôle" @change="changerRole(m, ($event.target as HTMLSelectElement).value as RoleSite)">
                <option v-for="(lib, r) in ROLES" :key="r" :value="r">{{ lib }}</option>
              </select>
              <button v-if="m.id !== etat?.moi.id" type="button" class="ms-btn" :aria-label="`Retirer ${m.email}`" @click="retirer(m)">✕</button>
            </div>
          </li>
          <li v-for="i in equipe.invitations" :key="i.id" class="ms-ligne-membre ms-attente">
            <div class="ms-resume"><strong>{{ i.email }}</strong><span>Invitation envoyée · {{ ROLES[i.role] }}</span></div>
            <button type="button" class="ms-btn" @click="annulerInvitation(i)">Annuler</button>
          </li>
        </ul>
        <form class="ms-carte" @submit.prevent="inviter">
          <h2>Inviter quelqu’un</h2>
          <div class="ms-ligne">
            <input v-model="invitation.email" type="email" required class="ms-champ ms-grand" placeholder="adresse e-mail" aria-label="Adresse e-mail">
            <select v-model="invitation.role" class="ms-champ" aria-label="Rôle">
              <option v-for="(lib, r) in ROLES" :key="r" :value="r">{{ lib }}</option>
            </select>
            <button type="submit" class="ms-btn ms-btn--fort">Inviter</button>
          </div>
          <div v-if="lienInvitation" class="ms-lien">
            <p v-if="lienInvitation.ajoute"><strong>{{ lienInvitation.email }}</strong> avait déjà un compte Bifrost : la personne fait maintenant partie de l’équipe et se connecte avec son mot de passe habituel.</p>
            <p v-else-if="lienInvitation.envoye">Un e-mail est parti pour <strong>{{ lienInvitation.email }}</strong>. Vous pouvez aussi lui transmettre ce lien (valable 7 jours) :</p>
            <p v-else>Envoyez ce lien à <strong>{{ lienInvitation.email }}</strong> (valable 7 jours) :</p>
            <div v-if="!lienInvitation.ajoute" class="ms-ligne">
              <input :value="lienInvitation.lien" readonly class="ms-champ ms-grand" aria-label="Lien d’invitation" @focus="($event.target as HTMLInputElement).select()">
              <button type="button" class="ms-btn" @click="copier(lienInvitation.lien)">Copier</button>
            </div>
          </div>
        </form>
      </section>

      <!-- Réglages -->
      <section v-else-if="onglet === 'reglages'">
        <h1>Réglages du site</h1>
        <form v-if="reglages" class="ms-carte" @submit.prevent="enregistrerReglages">
          <label>Nom du site
            <input v-model="formReglages.nom" class="ms-champ" required maxlength="120">
            <span class="ms-aide">Utilisé dans Bifrost et dans les e-mails. Le titre affiché sur le site se modifie directement sur la page.</span>
          </label>
          <label>Messages du formulaire envoyés à
            <input v-model="formReglages.emailMessages" class="ms-champ" maxlength="500" placeholder="vide = les responsables du site">
            <span class="ms-aide">Une ou plusieurs adresses, séparées par des virgules. Laissez vide pour les envoyer aux responsables.</span>
          </label>
          <button type="submit" class="ms-btn ms-btn--fort ms-debut">Enregistrer</button>
        </form>
        <div v-if="reglages" class="ms-carte">
          <h2>Adresse du site</h2>
          <p class="ms-adresse"><a :href="reglages.url || adressePublique" target="_blank" rel="noopener">{{ reglages.url || adressePublique }}</a></p>
          <p class="ms-aide">Pour mettre le site sur votre propre nom de domaine (par exemple monasso.fr), contactez votre développeur : il s’en occupe pour vous.</p>
        </div>
      </section>

      <!-- Mon compte -->
      <section v-else>
        <h1>Mon compte</h1>
        <div class="ms-carte">
          <h2>Connecté avec</h2>
          <p>{{ auth.currentUser?.email || 'Compte développeur' }}</p>
          <button type="button" class="ms-btn ms-debut" @click="deconnexion">Se déconnecter</button>
        </div>
        <div class="ms-carte ms-appli">
          <h2>Appli sur le téléphone</h2>
          <InstallerAppli />
          <p class="ms-aide">Bifrost s’installe depuis le navigateur, sans passer par un store. L’appli s’ouvre directement sur votre site.</p>
        </div>
        <form v-if="auth.role === 'client'" class="ms-carte" @submit.prevent="changerMotDePasse">
          <h2>Changer mon mot de passe</h2>
          <label>Mot de passe actuel<input v-model="mdp.actuel" type="password" class="ms-champ" autocomplete="current-password" required></label>
          <label>Nouveau mot de passe<input v-model="mdp.nouveau" type="password" class="ms-champ" autocomplete="new-password" minlength="10" required>
            <span class="ms-aide">10 caractères au moins. Une phrase facile à retenir fait un bon mot de passe.</span>
          </label>
          <label>Nouveau mot de passe, encore une fois<input v-model="mdp.confirmation" type="password" class="ms-champ" autocomplete="new-password" minlength="10" required></label>
          <button type="submit" class="ms-btn ms-btn--fort ms-debut">Changer le mot de passe</button>
        </form>
        <div v-if="auth.role === 'client'" class="ms-carte">
          <DoubleAuth :api="comptesService.doubleAuth" :compte="auth.currentUser?.email" />
        </div>
      </section>
    </main>

    <transition name="ms-fondu">
      <div v-if="info" class="ms-toast" role="status">{{ info }}</div>
    </transition>

    <div v-if="confirmation" class="ms-fond" @click.self="confirmation = null">
      <div class="ms-fenetre">
        <p>{{ confirmation.texte }}</p>
        <div class="ms-ligne ms-fin">
          <button type="button" class="ms-btn" @click="confirmation = null">Annuler</button>
          <button type="button" class="ms-btn ms-btn--danger" @click="confirmer">Confirmer</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.ms { min-height: 100vh; background: var(--bf-fond); color: var(--bf-texte); }
.ms-barre { position: sticky; top: 0; z-index: 10; display: flex; align-items: center; gap: 14px; padding: 10px 16px; background: var(--bf-surface); backdrop-filter: blur(18px); border-bottom: 1px solid var(--bf-bord); }
.ms-retour { flex: none; display: inline-flex; align-items: center; gap: 4px; padding: 9px 14px; border-radius: 999px; background: var(--bf-verre-fort); box-shadow: inset 0 0 0 1px var(--bf-bord); color: var(--bf-texte); font-size: 14px; font-weight: 600; text-decoration: none; }
.ms-retour:hover { background: var(--bf-survol); }
.ms-titre { min-width: 0; display: grid; }
.ms-titre strong { font-size: 16px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.ms-titre a { font-size: 13px; color: var(--bf-doux); text-decoration: none; }
.ms-titre a:hover { color: var(--bf-fort); }
.ms-onglets { display: flex; gap: 4px; overflow-x: auto; padding: 10px 16px; border-bottom: 1px solid var(--bf-bord); background: var(--bf-surface-legere); scrollbar-width: none; }
.ms-onglets button { flex: none; display: inline-flex; align-items: center; gap: 8px; padding: 9px 16px; border: 0; border-radius: 999px; background: none; color: var(--bf-texte); font: inherit; font-size: 14px; font-weight: 500; cursor: pointer; }
.ms-onglets button:hover { background: var(--bf-verre-fort); }
.ms-onglets button[aria-current='page'] { background: var(--bf-degrade); color: #fff; font-weight: 600; }
.ms-badge { min-width: 20px; height: 20px; padding: 0 6px; border-radius: 999px; background: var(--bf-accent); color: #fff; font-size: 11px; line-height: 20px; text-align: center; }
.ms-onglets button[aria-current='page'] .ms-badge { background: rgba(255, 255, 255, .3); }
.ms-contenu { max-width: 760px; margin: 0 auto; padding: 24px 16px 64px; }
.ms-contenu section { display: grid; gap: 16px; }
h1 { margin: 0; font-size: 26px; font-weight: 700; letter-spacing: -.01em; }
h2 { margin: 0; font-size: 16px; font-weight: 700; }
.ms-note { margin: -8px 0 0; color: var(--bf-doux); font-size: 14px; }
.ms-vide { padding: 32px; text-align: center; color: var(--bf-doux); border-radius: 16px; background: var(--bf-verre); }
.ms-alerte { margin: 0 0 16px; padding: 12px 16px; border-radius: 12px; background: rgba(220, 38, 38, .12); color: var(--bf-danger); cursor: pointer; }
.ms-liste { list-style: none; margin: 0; padding: 0; display: grid; gap: 6px; }
.ms-liste > li { border-radius: 14px; background: var(--bf-verre); }
.ms-message-tete { width: 100%; display: flex; align-items: center; gap: 12px; padding: 14px; border: 0; background: none; color: inherit; font: inherit; text-align: left; cursor: pointer; border-radius: 14px; }
.ms-message-tete:hover { background: var(--bf-verre-fort); }
.ms-point { width: 8px; height: 8px; flex: none; border-radius: 50%; }
.ms-non-lu .ms-point { background: var(--bf-accent); }
.ms-resume { flex: 1; min-width: 0; display: grid; }
.ms-resume strong, .ms-resume span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ms-resume strong { font-size: 15px; font-weight: 500; }
.ms-non-lu .ms-resume strong { font-weight: 700; }
.ms-resume span { font-size: 13px; color: var(--bf-doux); }
.ms-message-tete time { flex: none; font-size: 12px; color: var(--bf-doux); }
.ms-message-corps { padding: 0 14px 16px 34px; display: grid; gap: 14px; }
.ms-message-corps dl { margin: 0; display: grid; gap: 4px 16px; grid-template-columns: minmax(90px, max-content) 1fr; font-size: 15px; }
.ms-message-corps dt { color: var(--bf-doux); }
.ms-message-corps dd { margin: 0; white-space: pre-wrap; overflow-wrap: anywhere; }
.ms-ligne { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.ms-fin { justify-content: flex-end; }
.ms-ligne-membre { display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 12px 14px; flex-wrap: wrap; }
.ms-attente { opacity: .6; }
.ms-carte { display: grid; gap: 14px; padding: 20px; border-radius: 16px; background: var(--bf-verre); border: 1px solid var(--bf-bord); }
.ms-carte p { margin: 0; }
.ms-carte label { display: grid; gap: 6px; font-size: 14px; font-weight: 600; }
.ms-champ { min-height: 44px; padding: 10px 12px; border-radius: 10px; border: 1px solid var(--bf-bord-fort); background: var(--bf-champ); color: var(--bf-texte); font: inherit; font-weight: 400; }
.ms-champ option { color: var(--bf-texte); background: var(--bf-fond); }
.ms-grand { flex: 1 1 220px; min-width: 0; }
.ms-aide { font-size: 13px; font-weight: 400; color: var(--bf-doux); }
.ms-adresse a { font-weight: 600; color: var(--bf-fort); overflow-wrap: anywhere; }
.ms-debut { justify-self: start; }
.ms-btn { display: inline-flex; align-items: center; justify-content: center; min-height: 44px; padding: 0 18px; border: 0; border-radius: 999px; background: var(--bf-verre-fort); box-shadow: inset 0 0 0 1px var(--bf-bord); color: var(--bf-texte); font: inherit; font-size: 14px; font-weight: 600; text-decoration: none; cursor: pointer; white-space: nowrap; }
.ms-btn:hover { background: var(--bf-survol); }
.ms-btn--fort { background: var(--bf-degrade); color: #fff; box-shadow: none; }
.ms-btn--fort:hover { background: var(--bf-degrade); filter: brightness(1.1); }
.ms-btn--danger { background: #c0392b; color: #fff; box-shadow: none; }
.ms-rouge { color: var(--bf-danger); }
.ms-lien { display: grid; gap: 8px; padding: 12px; border-radius: 12px; background: rgba(224, 122, 74, .12); font-size: 14px; }
.ms-toast { position: fixed; left: 50%; bottom: 24px; transform: translateX(-50%); padding: 12px 20px; border-radius: 999px; background: var(--bf-surface); backdrop-filter: blur(16px); border: 1px solid var(--bf-bord); box-shadow: 0 10px 30px rgba(0, 0, 0, .35); font-size: 14px; z-index: 30; }
.ms-fond { position: fixed; inset: 0; z-index: 40; display: grid; place-items: center; padding: 16px; background: var(--bf-voile); backdrop-filter: blur(4px); }
.ms-fenetre { width: 100%; max-width: 400px; display: grid; gap: 16px; padding: 24px; border-radius: 20px; background: var(--bf-surface); border: 1px solid var(--bf-bord); box-shadow: 0 30px 80px rgba(0, 0, 0, .5); }
.ms-fenetre p { margin: 0; }
.ms-fondu-enter-active, .ms-fondu-leave-active { transition: opacity .2s; }
.ms-fondu-enter-from, .ms-fondu-leave-to { opacity: 0; }
@media (max-width: 560px) {
  .ms-retour span { display: none; }
  .ms-contenu { padding-top: 18px; }
  h1 { font-size: 22px; }
  .ms-message-tete time { display: none; }
  .ms-message-corps { padding-left: 14px; }
  .ms-message-corps dl { grid-template-columns: 1fr; }
  .ms-message-corps dd { margin-bottom: 8px; }
}
</style>
