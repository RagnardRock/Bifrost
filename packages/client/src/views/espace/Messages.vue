<script setup lang="ts">
/** Tous les messages des sites dont la personne est responsable, du plus récent au plus ancien. */
import { computed, onMounted, ref } from 'vue'
import { editeurService } from '@/services/editeur.service'
import { useEspace } from '@/composables/espace'
import ListeMessages, { type MessageSite } from '@/components/espace/ListeMessages.vue'

const { responsables, recharger } = useEspace()
const messages = ref<MessageSite[] | null>(null)
const filtre = ref<string>('')
const erreur = ref('')

const visibles = computed(() => (messages.value ?? []).filter((m) => !filtre.value || m.siteId === filtre.value))
const nonLus = (siteId?: string) => (messages.value ?? []).filter((m) => !m.lu && (!siteId || m.siteId === siteId)).length

async function charger() {
  erreur.value = ''
  await recharger()
  try {
    const parSite = await Promise.all(responsables.value.map(async (s) =>
      (await editeurService.messages(s.id)).map((m) => ({ ...m, siteId: s.id, siteNom: s.nom }))))
    messages.value = parSite.flat().sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  } catch {
    erreur.value = 'Impossible de charger les messages. Réessayez dans un instant.'
  }
}

onMounted(charger)
</script>

<template>
  <section class="em">
    <header class="em-tete">
      <h1>Messages</h1>
      <p class="em-note">Les messages envoyés par les formulaires de vos sites. Ils arrivent aussi par e-mail.</p>
    </header>

    <div v-if="responsables.length > 1" class="em-filtres" role="group" aria-label="Site">
      <button type="button" :aria-pressed="!filtre" @click="filtre = ''">Tous<b v-if="nonLus()">{{ nonLus() }}</b></button>
      <button v-for="s in responsables" :key="s.id" type="button" :aria-pressed="filtre === s.id" @click="filtre = s.id">{{ s.nom }}<b v-if="nonLus(s.id)">{{ nonLus(s.id) }}</b></button>
    </div>

    <p v-if="erreur" class="em-alerte" role="alert" @click="erreur = ''">{{ erreur }}</p>
    <p v-if="!messages && !erreur" class="em-vide">Chargement…</p>
    <p v-else-if="messages && !visibles.length" class="em-vide">Aucun message pour l’instant.</p>
    <ListeMessages v-if="visibles.length" :messages="visibles" :avec-site="responsables.length > 1 && !filtre" @change="recharger()" @supprime="messages = (messages ?? []).filter((m) => m.id !== $event)" @erreur="erreur = $event" />
  </section>
</template>

<style scoped>
.em { display: grid; gap: 16px; max-width: 820px; }
h1 { margin: 0; font-size: 28px; font-weight: 700; letter-spacing: -.01em; }
.em-tete { display: grid; gap: 6px; }
.em-note { margin: 0; color: var(--bf-doux); font-size: 14px; }
.em-vide { padding: 32px; text-align: center; color: var(--bf-doux); border-radius: 16px; background: var(--bf-verre); margin: 0; }
.em-alerte { margin: 0; padding: 12px 16px; border-radius: 12px; background: rgba(220, 38, 38, .12); color: var(--bf-danger); cursor: pointer; }
.em-filtres { display: flex; gap: 6px; overflow-x: auto; scrollbar-width: none; }
.em-filtres button { flex: none; display: inline-flex; align-items: center; gap: 6px; padding: 8px 14px; border: 0; border-radius: 999px; background: var(--bf-verre); box-shadow: inset 0 0 0 1px var(--bf-bord); color: var(--bf-texte); font: inherit; font-size: 14px; font-weight: 500; cursor: pointer; }
.em-filtres button[aria-pressed='true'] { background: var(--bf-degrade); color: #fff; box-shadow: none; font-weight: 600; }
.em-filtres b { min-width: 20px; height: 20px; padding: 0 6px; border-radius: 999px; background: var(--bf-accent); color: #fff; font-size: 11px; line-height: 20px; text-align: center; }
.em-filtres button[aria-pressed='true'] b { background: rgba(255, 255, 255, .3); }
</style>
