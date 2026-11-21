<script setup lang="ts">
/** Fiche client › Accès : inviter une personne sur tous les sites du client d'un coup. */
import { onMounted, ref, watch } from 'vue'
import { clientsService, type AccesClient, type RoleAcces } from '@/services/clients.service'

const props = defineProps<{ clientId: string; nbSites: number }>()
const ROLES: Record<RoleAcces, string> = { responsable: 'Responsable', redacteur: 'Rédacteur' }

const etat = ref<AccesClient | null>(null)
const form = ref<{ email: string; role: RoleAcces }>({ email: '', role: 'responsable' })
const lien = ref<{ email: string; lien: string; envoye: boolean; ajoute: boolean } | null>(null)
const erreur = ref('')
const occupe = ref(false)
const copie = ref(false)

const message = (e: unknown, defaut: string) => (e as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message || defaut

async function charger() {
  try { etat.value = await clientsService.acces(props.clientId) } catch (e) { erreur.value = message(e, 'Accès indisponibles.') }
}
onMounted(charger)
// Un site rattaché ou détaché change ce que donnent les accès : on relit
watch(() => props.nbSites, charger)

async function inviter() {
  erreur.value = ''
  occupe.value = true
  try {
    const email = form.value.email.trim()
    const r = await clientsService.inviter(props.clientId, email, form.value.role)
    lien.value = { email, ...r }
    form.value.email = ''
    await charger()
  } catch (e) { erreur.value = message(e, 'Invitation impossible.') } finally { occupe.value = false }
}

async function changerRole(personne: string, role: RoleAcces) {
  try { etat.value = await clientsService.changerRole(props.clientId, personne, role) } catch (e) { erreur.value = message(e, 'Rôle non modifié.') }
}

async function retirer(personne: string, email: string) {
  if (!window.confirm(`Retirer l’accès de ${email} à tous les sites de ce client ?`)) return
  try { etat.value = await clientsService.retirer(props.clientId, personne) } catch (e) { erreur.value = message(e, 'Retrait impossible.') }
}

async function annuler(jeton: string) {
  try { etat.value = await clientsService.annulerInvitation(props.clientId, jeton) } catch (e) { erreur.value = message(e, 'Action impossible.') }
}

async function copier() {
  if (!lien.value) return
  try { await navigator.clipboard.writeText(lien.value.lien); copie.value = true; setTimeout(() => (copie.value = false), 1500) } catch { /* sélection manuelle */ }
}
</script>

<template>
  <section class="glass-card bloc">
    <h2>Accès</h2>
    <p class="aide">Les personnes invitées ici modifient <strong>tous les sites de ce client</strong>, et ceux que vous lui rattacherez ensuite.</p>
    <p v-if="erreur" class="erreur" role="alert">{{ erreur }}</p>

    <ul v-if="etat && (etat.acces.length || etat.invitations.length)" class="lignes">
      <li v-for="a in etat.acces" :key="a.id">
        <div><strong>{{ a.email }}</strong><span class="doux">{{ a.doubleAuth ? '🔐 double authentification' : 'Compte actif' }}</span></div>
        <div class="actions">
          <select :value="a.role" class="input-field petit" aria-label="Rôle" @change="changerRole(a.id, ($event.target as HTMLSelectElement).value as RoleAcces)">
            <option v-for="(lib, r) in ROLES" :key="r" :value="r">{{ lib }}</option>
          </select>
          <button type="button" class="glass-button petit" title="Retirer l’accès" @click="retirer(a.id, a.email)">✕</button>
        </div>
      </li>
      <li v-for="i in etat.invitations" :key="i.id" class="attente">
        <div><strong>{{ i.email }}</strong><span class="doux">Invitation envoyée · {{ ROLES[i.role] }}</span></div>
        <button type="button" class="glass-button petit" @click="annuler(i.id)">Annuler</button>
      </li>
    </ul>
    <p v-else-if="etat" class="aide">Personne pour l’instant.</p>

    <p v-if="!nbSites" class="aide">Rattachez d’abord un site à ce client pour pouvoir inviter.</p>
    <form v-else class="inviter" @submit.prevent="inviter">
      <input v-model="form.email" type="email" required class="input-field" placeholder="adresse e-mail" aria-label="Adresse e-mail">
      <select v-model="form.role" class="input-field" aria-label="Rôle">
        <option v-for="(lib, r) in ROLES" :key="r" :value="r">{{ lib }}</option>
      </select>
      <button type="submit" class="btn-primary" :disabled="occupe">Inviter</button>
    </form>
    <p class="aide">Responsable : publie et gère l’équipe. Rédacteur : modifie, un responsable publie.</p>

    <div v-if="lien" class="lien">
      <p v-if="lien.ajoute"><strong>{{ lien.email }}</strong> avait déjà un compte : l’accès est donné, il se connecte avec son mot de passe habituel.</p>
      <template v-else>
        <p v-if="lien.envoye">E-mail envoyé à <strong>{{ lien.email }}</strong>. Vous pouvez aussi lui transmettre ce lien (7 jours) :</p>
        <p v-else>Envoyez ce lien à <strong>{{ lien.email }}</strong> (valable 7 jours) :</p>
        <div class="inviter">
          <input :value="lien.lien" readonly class="input-field" aria-label="Lien d’invitation" @focus="($event.target as HTMLInputElement).select()">
          <button type="button" class="glass-button" @click="copier">{{ copie ? 'Copié ✓' : 'Copier' }}</button>
        </div>
      </template>
    </div>
  </section>
</template>

<style scoped>
.bloc { padding: 20px; display: grid; gap: 14px; }
.bloc h2 { font-size: 16px; font-weight: 700; margin: 0; }
.aide { margin: 0; font-size: 13px; color: var(--bf-doux); }
.erreur { margin: 0; font-size: 13px; color: var(--bf-danger); }
.lignes { list-style: none; margin: 0; padding: 0; display: grid; gap: 6px; }
.lignes li { display: flex; justify-content: space-between; align-items: center; gap: 10px; padding: 10px 12px; border-radius: 10px; background: var(--bf-verre); flex-wrap: wrap; }
.lignes li > div:first-child { display: grid; gap: 2px; min-width: 0; }
.lignes strong { font-size: 14px; color: var(--bf-fort); overflow-wrap: anywhere; }
.doux { font-size: 12.5px; color: var(--bf-doux); }
.attente { opacity: .7; }
.actions { display: flex; gap: 6px; align-items: center; }
.petit { padding: 6px 10px; width: auto; }
.inviter { display: flex; gap: 8px; flex-wrap: wrap; }
.inviter input { flex: 1 1 200px; min-width: 0; }
.inviter select { flex: 0 0 auto; width: auto; }
.lien { display: grid; gap: 8px; padding: 12px; border-radius: 10px; background: var(--bf-verre); font-size: 13.5px; }
.lien p { margin: 0; }
</style>
