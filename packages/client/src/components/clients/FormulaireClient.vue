<script setup lang="ts">
/** Champs d'une fiche client : contact, contrat, notes. */
import { STATUTS, PERIODES, type FormClient } from '@/services/clients.service'

const f = defineModel<FormClient>({ required: true })
</script>

<template>
  <div class="fc">
    <fieldset>
      <legend>Client</legend>
      <label class="large">Nom de la structure<input v-model="f.nom" class="input-field" required maxlength="120" placeholder="Association, commerce, établissement…"></label>
      <label>Personne à contacter<input v-model="f.contactNom" class="input-field" maxlength="120" autocomplete="off"></label>
      <label>E-mail<input v-model="f.email" class="input-field" type="email" maxlength="200" autocomplete="off"></label>
      <label>Téléphone<input v-model="f.telephone" class="input-field" type="tel" maxlength="40" autocomplete="off"></label>
      <label class="large">Adresse<input v-model="f.adresse" class="input-field" maxlength="300" autocomplete="off"></label>
    </fieldset>

    <fieldset>
      <legend>Contrat</legend>
      <label>Statut
        <select v-model="f.statut" class="input-field">
          <option v-for="(lib, s) in STATUTS" :key="s" :value="s">{{ lib }}</option>
        </select>
      </label>
      <label>Formule<input v-model="f.formule" class="input-field" maxlength="120" placeholder="Site vitrine + formulaire…"></label>
      <div class="prix">
        <label>Prix (€)<input v-model.number="f.prix" class="input-field" type="number" min="0" step="0.01" inputmode="decimal"></label>
        <label>Période
          <select v-model="f.periode" class="input-field">
            <option value="">—</option>
            <option v-for="(lib, p) in PERIODES" :key="p" :value="p">{{ lib }}</option>
          </select>
        </label>
      </div>
      <label>Début<input v-model="f.debut" class="input-field" type="date"></label>
      <label>Échéance<input v-model="f.echeance" class="input-field" type="date"><span class="aide">Renouvellement ou fin de l’essai.</span></label>
    </fieldset>

    <label class="notes">Notes<textarea v-model="f.notes" class="input-field" rows="4" maxlength="5000" placeholder="Ce qui a été convenu, accès, préférences…" /></label>
  </div>
</template>

<style scoped>
.fc { display: grid; gap: 18px; }
fieldset { border: 0; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
legend { font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; color: var(--bf-doux); margin-bottom: 10px; }
label { display: grid; gap: 6px; font-size: 14px; font-weight: 600; align-content: start; }
label .input-field { font-weight: 400; width: 100%; }
.large, .notes { grid-column: 1 / -1; }
.prix { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 8px; }
.aide { font-size: 12.5px; font-weight: 400; color: var(--bf-doux); }
textarea { resize: vertical; }
@media (max-width: 560px) { fieldset { grid-template-columns: minmax(0, 1fr); } }
</style>
