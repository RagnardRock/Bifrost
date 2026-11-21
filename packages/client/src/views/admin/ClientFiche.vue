<script setup lang="ts">
/** Fiche d'un client : contact, contrat, notes, et ses sites. */
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import FormulaireClient from '@/components/clients/FormulaireClient.vue'
import StatutClient from '@/components/clients/StatutClient.vue'
import AccesClient from '@/components/clients/AccesClient.vue'
import { clientsService, versFormulaire, prixLisible, joursAvantEcheance, type Client, type FormClient } from '@/services/clients.service'
import { suiviService, adresseSite, type SiteSuivi } from '@/services/suivi.service'

const route = useRoute()
const router = useRouter()
const id = computed(() => route.params.id as string)
const client = ref<Client | null>(null)
const form = ref<FormClient>(versFormulaire())
const sites = ref<SiteSuivi[]>([])
const aRattacher = ref('')
const erreur = ref('')
const message = ref('')
const occupe = ref(false)

async function charger() {
  try {
    const [c, s] = await Promise.all([clientsService.fiche(id.value), suiviService.sites()])
    client.value = c
    form.value = versFormulaire(c)
    sites.value = s
  } catch (e: any) {
    erreur.value = e?.response?.data?.error?.message || 'Impossible de charger ce client.'
  }
}

async function enregistrer() {
  occupe.value = true
  try {
    client.value = await clientsService.modifier(id.value, form.value)
    form.value = versFormulaire(client.value)
    message.value = 'Fiche enregistrée'
  } catch (e: any) {
    erreur.value = e?.response?.data?.error?.message || 'Non enregistré.'
  } finally {
    occupe.value = false
  }
}

// Sites libres en premier, puis ceux d'autres clients (rattacher les déplace)
const autresSites = computed(() => sites.value.filter((s) => s.client?.id !== id.value).sort((a, b) => Number(!!a.client) - Number(!!b.client)))

async function rattacher() {
  if (!aRattacher.value) return
  try {
    await suiviService.rattacher(aRattacher.value, id.value)
    aRattacher.value = ''
    await charger()
  } catch (e: any) {
    erreur.value = e?.response?.data?.error?.message || 'Rattachement impossible.'
  }
}

async function detacher(siteId: string, nom: string) {
  if (!window.confirm(`Détacher « ${nom} » de ce client ? Le site reste en ligne, sans client.`)) return
  try { await suiviService.rattacher(siteId, null); await charger() } catch (e: any) { erreur.value = e?.response?.data?.error?.message || 'Impossible.' }
}

async function supprimer() {
  if (!client.value) return
  const n = client.value.sites.length
  if (!window.confirm(`Supprimer la fiche de ${client.value.nom} ?${n ? ` Ses ${n} site(s) restent en ligne, sans client.` : ''}`)) return
  try { await clientsService.supprimer(id.value); router.push('/admin/clients') } catch (e: any) { erreur.value = e?.response?.data?.error?.message || 'Suppression impossible.' }
}

const echeance = computed(() => (client.value ? joursAvantEcheance(client.value) : null))
const mailto = computed(() => client.value?.email ? `mailto:${client.value.email}` : '')
const tel = computed(() => client.value?.telephone ? `tel:${client.value.telephone.replace(/[^\d+]/g, '')}` : '')

onMounted(charger)
</script>

<template>
  <div>
    <router-link to="/admin/clients" class="surtitre retour">← Tous les clients</router-link>

    <p v-if="erreur" class="glass-card p-4 my-4 text-red-500" role="alert" @click="erreur = ''">{{ erreur }}</p>
    <p v-if="message" class="glass-card p-4 my-4 text-green-600" role="status" @click="message = ''">{{ message }}</p>

    <template v-if="client">
      <div class="flex flex-wrap items-end justify-between gap-4 mb-8">
        <div>
          <h1>{{ client.nom }}</h1>
          <p class="chapeau entete">
            <StatutClient :statut="client.statut" />
            <span v-if="prixLisible(client)">{{ prixLisible(client) }}</span>
            <span v-if="echeance !== null" :class="{ alerte: echeance <= 30, danger: echeance < 0 }">échéance {{ new Date(client.echeance!).toLocaleDateString('fr-FR') }}</span>
          </p>
        </div>
        <div class="flex gap-2">
          <a v-if="mailto" :href="mailto" class="glass-button">Écrire</a>
          <a v-if="tel" :href="tel" class="glass-button">Appeler</a>
        </div>
      </div>

      <div class="colonnes">
        <form class="glass-card bloc" @submit.prevent="enregistrer">
          <FormulaireClient v-model="form" />
          <div class="flex flex-wrap justify-between gap-2">
            <button type="button" class="glass-button text-red-500" @click="supprimer">Supprimer la fiche</button>
            <button type="submit" class="btn-primary" :disabled="occupe">Enregistrer</button>
          </div>
        </form>

        <div class="pile">
        <section class="glass-card bloc">
          <h2>Sites</h2>
          <p v-if="!client.sites.length" class="text-sm text-gray-500">Aucun site rattaché.</p>
          <ul class="lignes">
            <li v-for="s in client.sites" :key="s.id">
              <div>
                <router-link :to="`/admin/sites/${s.slug || s.id}`"><strong>{{ s.name }}</strong></router-link>
                <a :href="s.url || adresseSite(s)" target="_blank" rel="noopener" class="adresse">{{ s.url || adresseSite(s) }}</a>
                <span v-if="s.enPause" class="pause">En pause</span>
              </div>
              <button type="button" class="glass-button petit" title="Détacher de ce client" @click="detacher(s.id, s.name)">✕</button>
            </li>
          </ul>
          <form v-if="autresSites.length" class="rattacher" @submit.prevent="rattacher">
            <select v-model="aRattacher" class="input-field" aria-label="Site à rattacher">
              <option value="">Rattacher un site…</option>
              <option v-for="s in autresSites" :key="s.id" :value="s.id">{{ s.nom }}{{ s.client ? ` (chez ${s.client.nom})` : '' }}</option>
            </select>
            <button type="submit" class="glass-button" :disabled="!aRattacher">Rattacher</button>
          </form>
        </section>
        <AccesClient :client-id="client.id" :nb-sites="client.sites.length" />
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.retour { text-decoration: none; }
.retour:hover { color: var(--bf-fort); }
.entete { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 14px; }
.entete .alerte { color: var(--bf-accent); font-weight: 600; }
.entete .danger { color: var(--bf-danger); }
.colonnes { display: grid; grid-template-columns: minmax(0, 3fr) minmax(0, 2fr); gap: 24px; align-items: start; }
@media (max-width: 1024px) { .colonnes { grid-template-columns: minmax(0, 1fr); } }
.bloc { padding: 20px; display: grid; gap: 16px; }
.pile { display: grid; gap: 24px; min-width: 0; }
.bloc h2 { font-size: 16px; font-weight: 700; margin: 0; }
.lignes { list-style: none; margin: 0; padding: 0; display: grid; gap: 6px; }
.lignes li { display: flex; justify-content: space-between; align-items: center; gap: 10px; padding: 10px 12px; border-radius: 10px; background: var(--bf-verre); }
.lignes li > div { display: grid; gap: 2px; min-width: 0; }
.lignes strong { font-size: 14px; color: var(--bf-fort); }
.adresse { font-size: 12.5px; color: var(--bf-doux); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pause { font-size: 12px; font-weight: 600; color: var(--bf-accent); }
.petit { padding: 6px 10px; }
.rattacher { display: flex; gap: 8px; }
.rattacher select { flex: 1; min-width: 0; }
</style>
