<script setup lang="ts">
/**
 * Double authentification d'un compte (client ou dev) : activer avec une appli, codes de secours, désactiver.
 * Le parent fournit les appels (`api`) : /comptes/double-auth ou /auth/double-auth.
 */
import { onMounted, ref } from 'vue'
import QRCode from 'qrcode'
import type { ApiDoubleAuth, EtatDoubleAuth } from '@/services/comptes.service'

const props = defineProps<{ api: ApiDoubleAuth; compte?: string }>()

const etat = ref<EtatDoubleAuth | null>(null)
const etape = ref<'repos' | 'scanner' | 'codes' | 'desactiver' | 'regenerer'>('repos')
const qr = ref('')
const secret = ref('')
const voirSecret = ref(false)
const code = ref('')
const motDePasse = ref('')
const codes = ref<string[]>([])
const erreur = ref('')
const occupe = ref(false)

const message = (e: any, defaut: string) => e?.response?.data?.error?.message || defaut

async function charger() {
  try { etat.value = await props.api.etat() } catch (e) { erreur.value = message(e, 'Impossible de lire l’état de la double authentification.') }
}

async function commencer() {
  erreur.value = ''
  occupe.value = true
  try {
    const r = await props.api.preparer()
    secret.value = r.secret
    qr.value = await QRCode.toDataURL(r.adresse, { margin: 1, width: 220, errorCorrectionLevel: 'M' })
    code.value = ''
    voirSecret.value = false
    etape.value = 'scanner'
  } catch (e) {
    erreur.value = message(e, 'Impossible de commencer.')
  } finally {
    occupe.value = false
  }
}

async function activer() {
  erreur.value = ''
  occupe.value = true
  try {
    codes.value = (await props.api.activer(code.value)).codes
    etape.value = 'codes'
    await charger()
  } catch (e) {
    erreur.value = message(e, 'Code refusé.')
  } finally {
    occupe.value = false
  }
}

async function desactiver() {
  erreur.value = ''
  occupe.value = true
  try {
    await props.api.desactiver(motDePasse.value, code.value)
    motDePasse.value = ''
    code.value = ''
    etape.value = 'repos'
    await charger()
  } catch (e) {
    erreur.value = message(e, 'Impossible de désactiver.')
  } finally {
    occupe.value = false
  }
}

async function regenerer() {
  erreur.value = ''
  occupe.value = true
  try {
    codes.value = (await props.api.codes(code.value)).codes
    code.value = ''
    etape.value = 'codes'
    await charger()
  } catch (e) {
    erreur.value = message(e, 'Code refusé.')
  } finally {
    occupe.value = false
  }
}

const texteCodes = () => `Codes de secours Bifrost${props.compte ? ` (${props.compte})` : ''}\nChaque code ne sert qu’une fois.\n\n${codes.value.join('\n')}\n`
async function copierCodes() {
  try { await navigator.clipboard.writeText(texteCodes()); erreur.value = ''; copie.value = true } catch { erreur.value = 'Copie impossible : notez les codes à la main.' }
}
const copie = ref(false)
function telechargerCodes() {
  const lien = document.createElement('a')
  lien.href = URL.createObjectURL(new Blob([texteCodes()], { type: 'text/plain' }))
  lien.download = 'bifrost-codes-de-secours.txt'
  lien.click()
  setTimeout(() => URL.revokeObjectURL(lien.href), 5000)
}
function annuler() {
  etape.value = 'repos'
  code.value = ''
  motDePasse.value = ''
  erreur.value = ''
}

onMounted(charger)
</script>

<template>
  <div class="da">
    <div class="da-tete">
      <h2>Double authentification</h2>
      <span v-if="etat" class="da-etat" :class="{ 'da-etat--on': etat.actif }">{{ etat.actif ? 'Activée' : 'Désactivée' }}</span>
    </div>

    <!-- Repos -->
    <template v-if="etape === 'repos' && etat">
      <p v-if="!etat.actif" class="da-texte">En plus du mot de passe, un code à 6 chiffres donné par une appli de votre téléphone (Google Authenticator, Microsoft Authenticator, 2FAS…). Même si quelqu’un devine votre mot de passe, il ne peut pas entrer.</p>
      <p v-else class="da-texte">À chaque connexion, Bifrost demande le code de votre appli. Il vous reste <strong>{{ etat.codesRestants }}</strong> code{{ etat.codesRestants > 1 ? 's' : '' }} de secours.</p>
      <p v-if="etat.actif && etat.codesRestants <= 3" class="da-alerte">Il reste peu de codes de secours : créez-en de nouveaux.</p>
      <div class="da-ligne">
        <button v-if="!etat.actif" type="button" class="da-btn da-btn--fort" :disabled="occupe" @click="commencer">Activer</button>
        <template v-else>
          <button type="button" class="da-btn" @click="etape = 'regenerer'; erreur = ''">Nouveaux codes de secours</button>
          <button type="button" class="da-btn da-btn--rouge" @click="etape = 'desactiver'; erreur = ''">Désactiver</button>
        </template>
      </div>
    </template>

    <!-- 1. Scanner, 2. Taper le code -->
    <form v-else-if="etape === 'scanner'" class="da-form" @submit.prevent="activer">
      <ol class="da-etapes">
        <li>Ouvrez votre appli d’authentification et scannez ce QR code.</li>
      </ol>
      <img v-if="qr" :src="qr" alt="QR code à scanner avec l’appli d’authentification" class="da-qr" width="220" height="220">
      <button type="button" class="da-lien" @click="voirSecret = !voirSecret">{{ voirSecret ? 'Masquer la clé' : 'Impossible de scanner ? Taper la clé à la main' }}</button>
      <code v-if="voirSecret" class="da-secret">{{ secret.match(/.{1,4}/g)?.join(' ') }}</code>
      <ol class="da-etapes" start="2">
        <li>Tapez le code à 6 chiffres que l’appli affiche.</li>
      </ol>
      <input v-model="code" class="da-champ da-code" inputmode="numeric" autocomplete="one-time-code" maxlength="7" placeholder="123 456" required aria-label="Code à 6 chiffres">
      <div class="da-ligne">
        <button type="submit" class="da-btn da-btn--fort" :disabled="occupe">Activer</button>
        <button type="button" class="da-btn" @click="annuler">Annuler</button>
      </div>
    </form>

    <!-- Codes de secours (montrés une seule fois) -->
    <div v-else-if="etape === 'codes'" class="da-form">
      <p class="da-texte"><strong>Gardez ces codes de secours en lieu sûr.</strong> Ils servent si vous perdez votre téléphone. Chacun ne marche qu’une fois, et ils ne seront plus affichés.</p>
      <ul class="da-codes">
        <li v-for="c in codes" :key="c"><code>{{ c }}</code></li>
      </ul>
      <div class="da-ligne">
        <button type="button" class="da-btn" @click="copierCodes">{{ copie ? 'Copiés' : 'Copier' }}</button>
        <button type="button" class="da-btn" @click="telechargerCodes">Télécharger</button>
        <button type="button" class="da-btn da-btn--fort" @click="etape = 'repos'; codes = []; copie = false">C’est noté</button>
      </div>
    </div>

    <!-- Désactiver -->
    <form v-else-if="etape === 'desactiver'" class="da-form" @submit.prevent="desactiver">
      <p class="da-texte">Pour désactiver, confirmez votre mot de passe et un code de l’appli (ou un code de secours).</p>
      <label>Mot de passe<input v-model="motDePasse" type="password" class="da-champ" autocomplete="current-password" required></label>
      <label>Code<input v-model="code" class="da-champ da-code" inputmode="numeric" autocomplete="one-time-code" maxlength="20" placeholder="123 456" required></label>
      <div class="da-ligne">
        <button type="submit" class="da-btn da-btn--rouge-plein" :disabled="occupe">Désactiver</button>
        <button type="button" class="da-btn" @click="annuler">Annuler</button>
      </div>
    </form>

    <!-- Nouveaux codes -->
    <form v-else-if="etape === 'regenerer'" class="da-form" @submit.prevent="regenerer">
      <p class="da-texte">Les anciens codes de secours ne marcheront plus. Tapez un code de l’appli pour confirmer.</p>
      <input v-model="code" class="da-champ da-code" inputmode="numeric" autocomplete="one-time-code" maxlength="20" placeholder="123 456" required aria-label="Code">
      <div class="da-ligne">
        <button type="submit" class="da-btn da-btn--fort" :disabled="occupe">Créer de nouveaux codes</button>
        <button type="button" class="da-btn" @click="annuler">Annuler</button>
      </div>
    </form>

    <p v-if="erreur" class="da-erreur" role="alert">{{ erreur }}</p>
  </div>
</template>

<style scoped>
.da { display: grid; gap: 14px; }
.da-tete { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
.da-tete h2 { margin: 0; font-size: 16px; font-weight: 700; }
.da-etat { padding: 3px 10px; border-radius: 999px; font-size: 12px; font-weight: 600; background: var(--bf-verre-fort); color: var(--bf-doux); }
.da-etat--on { background: rgba(34, 197, 94, .15); color: var(--bf-ok); }
.da-texte { margin: 0; font-size: 14px; line-height: 1.5; }
.da-alerte { margin: 0; font-size: 13px; font-weight: 600; color: var(--bf-accent); }
.da-erreur { margin: 0; font-size: 14px; color: var(--bf-danger); }
.da-form { display: grid; gap: 12px; }
.da-form label { display: grid; gap: 6px; font-size: 14px; font-weight: 600; }
.da-etapes { margin: 0; padding-left: 20px; font-size: 14px; list-style: decimal; }
.da-qr { width: 220px; height: 220px; border-radius: 12px; background: #fff; padding: 6px; image-rendering: pixelated; }
.da-lien { justify-self: start; padding: 0; border: 0; background: none; color: var(--bf-accent); font: inherit; font-size: 13px; cursor: pointer; text-decoration: underline; }
.da-secret { justify-self: start; padding: 8px 12px; border-radius: 8px; background: var(--bf-verre-fort); font-size: 15px; letter-spacing: .08em; user-select: all; overflow-wrap: anywhere; }
.da-champ { min-height: 44px; padding: 10px 12px; border-radius: 10px; border: 1px solid var(--bf-bord-fort); background: var(--bf-champ); color: var(--bf-texte); font: inherit; font-weight: 400; }
.da-code { max-width: 220px; font-size: 20px; letter-spacing: .2em; text-align: center; font-variant-numeric: tabular-nums; }
.da-codes { list-style: none; margin: 0; padding: 12px; display: grid; grid-template-columns: repeat(2, max-content); gap: 8px 28px; border-radius: 12px; background: var(--bf-verre-fort); }
.da-codes code { font-size: 15px; letter-spacing: .05em; }
.da-ligne { display: flex; flex-wrap: wrap; gap: 8px; }
.da-btn { display: inline-flex; align-items: center; justify-content: center; min-height: 44px; padding: 0 18px; border: 0; border-radius: 999px; background: var(--bf-verre-fort); box-shadow: inset 0 0 0 1px var(--bf-bord); color: var(--bf-texte); font: inherit; font-size: 14px; font-weight: 600; cursor: pointer; white-space: nowrap; }
.da-btn:disabled { opacity: .5; cursor: default; }
.da-btn--fort { background: var(--bf-degrade); color: #fff; box-shadow: none; }
.da-btn--rouge { color: var(--bf-danger); }
.da-btn--rouge-plein { background: var(--bf-danger); color: #fff; box-shadow: none; }
</style>
