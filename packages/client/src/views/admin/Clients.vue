<script setup lang="ts">
/** Espace dev : les clients, leur contrat, et les échéances à surveiller. */
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import FormulaireClient from '@/components/clients/FormulaireClient.vue'
import StatutClient from '@/components/clients/StatutClient.vue'
import { clientsService, versFormulaire, prixLisible, joursAvantEcheance, type Client, type FormClient } from '@/services/clients.service'

const router = useRouter()
const clients = ref<Client[] | null>(null)
const erreur = ref('')
const nouveau = ref<FormClient | null>(null)
const occupe = ref(false)
const filtre = ref<'tous' | 'en-cours' | 'termines'>('en-cours')

async function charger() {
  try { clients.value = await clientsService.lister() } catch (e: any) { erreur.value = e?.response?.data?.error?.message || 'Impossible de charger les clients.' }
}

async function creer() {
  if (!nouveau.value) return
  occupe.value = true
  erreur.value = ''
  try {
    const c = await clientsService.creer(nouveau.value)
    nouveau.value = null
    router.push(`/admin/clients/${c.id}`)
  } catch (e: any) {
    erreur.value = e?.response?.data?.error?.message || 'Le client n’a pas pu être créé.'
  } finally {
    occupe.value = false
  }
}

const enCours = (c: Client) => c.statut !== 'termine'
const visibles = computed(() => (clients.value ?? []).filter((c) => filtre.value === 'tous' || (filtre.value === 'en-cours' ? enCours(c) : !enCours(c))))

/** Échéances passées ou dans les 30 jours, des clients en cours. */
const aSurveiller = computed(() =>
  (clients.value ?? [])
    .filter(enCours)
    .map((c) => ({ c, j: joursAvantEcheance(c) }))
    .filter((x): x is { c: Client; j: number } => x.j !== null && x.j <= 30)
    .sort((a, b) => a.j - b.j),
)

/** Revenu mensuel des contrats actifs (annuel / 12, paiements uniques exclus). */
const mensuel = computed(() =>
  (clients.value ?? []).filter((c) => c.statut === 'actif' && c.prix != null).reduce((t, c) => t + (c.periode === 'mois' ? c.prix! : c.periode === 'an' ? c.prix! / 12 : 0), 0),
)
const euros = (centimes: number) => (centimes / 100).toLocaleString('fr-FR', { maximumFractionDigits: 0 }) + ' €'
const nb = (statut: string) => (clients.value ?? []).filter((c) => c.statut === statut).length

function texteEcheance(j: number) {
  if (j < 0) return `dépassée de ${-j} j`
  if (j === 0) return 'aujourd’hui'
  return `dans ${j} j`
}
const dateCourte = (d: string) => new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })

onMounted(charger)
</script>

<template>
  <div>
    <div class="flex flex-wrap items-end justify-between gap-4 mb-8">
      <div>
        <span class="surtitre">Espace développeur</span>
        <h1>Clients</h1>
        <p class="chapeau">Contacts, contrats et échéances. Un client peut avoir plusieurs sites.</p>
      </div>
      <button type="button" class="btn-primary" @click="nouveau = versFormulaire()">+ Nouveau client</button>
    </div>

    <p v-if="erreur" class="glass-card p-4 mb-6 text-red-500" role="alert" @click="erreur = ''">{{ erreur }}</p>

    <div v-if="!clients" class="text-gray-500">Chargement…</div>
    <template v-else>
      <div class="resume">
        <div class="glass-card"><strong>{{ nb('actif') }}</strong><span>actifs</span></div>
        <div class="glass-card"><strong>{{ nb('essai') }}</strong><span>en essai</span></div>
        <div class="glass-card"><strong>{{ euros(mensuel) }}</strong><span>par mois (contrats actifs)</span></div>
      </div>

      <section v-if="aSurveiller.length" class="glass-card surveiller">
        <h2>Échéances à surveiller</h2>
        <ul>
          <li v-for="{ c, j } in aSurveiller" :key="c.id" :class="{ depassee: j < 0 }">
            <router-link :to="`/admin/clients/${c.id}`">{{ c.nom }}</router-link>
            <span>{{ dateCourte(c.echeance!) }} · {{ texteEcheance(j) }}</span>
          </li>
        </ul>
      </section>

      <div class="filtres" role="tablist">
        <button v-for="(lib, f) in { 'en-cours': 'En cours', termines: 'Terminés', tous: 'Tous' }" :key="f" type="button" role="tab" :aria-selected="filtre === f" @click="filtre = f">{{ lib }}</button>
      </div>

      <div v-if="!clients.length" class="glass-card p-10 text-center text-gray-500">Aucun client pour l’instant. Créez une fiche, puis rattachez-y ses sites.</div>
      <p v-else-if="!visibles.length" class="text-sm text-gray-500">Aucun client dans cette liste.</p>

      <ul v-else class="liste">
        <li v-for="c in visibles" :key="c.id">
          <router-link :to="`/admin/clients/${c.id}`" class="glass-card ligne">
            <div class="ident">
              <strong>{{ c.nom }}</strong>
              <span>{{ [c.contactNom, c.email, c.telephone].filter(Boolean).join(' · ') || 'Pas de contact' }}</span>
            </div>
            <div class="contrat">
              <StatutClient :statut="c.statut" />
              <span>{{ [c.formule, prixLisible(c)].filter(Boolean).join(' · ') }}</span>
            </div>
            <div class="sites">
              <span v-if="!c.sites.length" class="vide">Aucun site</span>
              <span v-for="s in c.sites" :key="s.id" class="site">{{ s.name }}<template v-if="s.enPause"> ⏸</template></span>
            </div>
          </router-link>
        </li>
      </ul>
    </template>

    <div v-if="nouveau" class="fond" @click.self="nouveau = null">
      <form class="glass-card fenetre" @submit.prevent="creer">
        <h2 class="text-xl">Nouveau client</h2>
        <FormulaireClient v-model="nouveau" />
        <div class="flex justify-end gap-2">
          <button type="button" class="glass-button" @click="nouveau = null">Annuler</button>
          <button type="submit" class="btn-primary" :disabled="occupe">Créer la fiche</button>
        </div>
      </form>
    </div>
  </div>
</template>

<style scoped>
.resume { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; margin-bottom: 20px; }
.resume div { padding: 16px 18px; display: grid; gap: 2px; box-shadow: none; }
.resume strong { font-size: 26px; line-height: 1.1; color: var(--bf-fort); font-variant-numeric: tabular-nums; }
.resume span { font-size: 13px; color: var(--bf-doux); }
.surveiller { padding: 16px 18px; margin-bottom: 20px; box-shadow: none; background: rgba(224, 122, 74, .08); }
.surveiller h2 { font-size: 15px; font-weight: 700; margin: 0 0 8px; }
.surveiller ul { list-style: none; margin: 0; padding: 0; display: grid; gap: 4px; }
.surveiller li { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 4px 12px; font-size: 14px; }
.surveiller a { font-weight: 600; color: var(--bf-fort); }
.surveiller span { color: var(--bf-doux); }
.surveiller .depassee span { color: var(--bf-danger); font-weight: 600; }
.filtres { display: flex; gap: 4px; margin-bottom: 12px; }
.filtres button { padding: 6px 14px; border-radius: 999px; border: 0; background: none; color: var(--bf-texte); font: inherit; font-size: 14px; cursor: pointer; }
.filtres button[aria-selected='true'] { background: var(--bf-verre-fort); color: var(--bf-fort); font-weight: 600; }
.liste { list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; }
.ligne { display: grid; grid-template-columns: minmax(0, 1.3fr) minmax(0, 1fr) minmax(0, 1fr); gap: 16px; align-items: center; padding: 14px 18px; text-decoration: none; color: inherit; box-shadow: none; transition: background .15s; }
.ligne:hover { background: var(--bf-verre-fort); }
.ident, .contrat { display: grid; gap: 4px; min-width: 0; }
.ident strong { font-size: 16px; color: var(--bf-fort); }
.ident span, .contrat span { font-size: 13px; color: var(--bf-doux); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.contrat .statut { justify-self: start; }
.sites { display: flex; flex-wrap: wrap; gap: 6px; }
.site { padding: 3px 10px; border-radius: 8px; background: var(--bf-verre); font-size: 13px; }
.vide { font-size: 13px; color: var(--bf-doux); }
.fond { position: fixed; inset: 0; background: var(--bf-voile); backdrop-filter: blur(4px); display: grid; place-items: center; padding: 16px; z-index: 40; overflow-y: auto; }
.fenetre { width: 100%; max-width: 620px; padding: 24px; display: grid; gap: 18px; background: var(--bf-surface); }
@media (max-width: 760px) {
  .ligne { grid-template-columns: minmax(0, 1fr); gap: 10px; }
  .resume { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .resume div:last-child { grid-column: 1 / -1; }
}
</style>
