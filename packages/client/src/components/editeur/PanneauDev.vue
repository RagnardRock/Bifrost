<script setup lang="ts">
/**
 * Mode dev : panneau à côté de l'aperçu. Montre l'élément sélectionné dans la page
 * (fil d'Ariane, texte, flags, attributs) et la liste de tous les flags de la page.
 * Le panneau n'appelle pas l'API : il émet des opérations que l'éditeur envoie au serveur.
 */
import { computed, ref, watch } from 'vue'
import type { BlocDev } from '@/services/editeur.service'

export interface SelectionDev {
  chemin: number[]
  balises: string[]
  fil: string[]
  balise: string
  feuille: boolean
  texte: string
  flags: Record<string, string | boolean>
  attributs: Record<string, string>
  contexte: { liste: string | null; dansElement: boolean; dansRiche: boolean }
  suggestion: { cle: string; type: string }
  peutMonter: boolean
  peutDescendre: boolean
}
export interface FlagPage { chemin: number[]; balise: string; flags: Record<string, string | boolean>; profondeur: number; ignore: boolean }
export interface AlerteDev { chemin: number[]; texte: string }
export type OperationDev =
  | { op: 'flags'; flags: Record<string, string | number | boolean | null> }
  | { op: 'texte'; valeur: string }
  | { op: 'attribut'; nom: 'alt' | 'href' | 'title'; valeur: string | null }
  | { op: 'supprimer' }
  | { op: 'dupliquer' }
  | { op: 'deplacer'; sens: 'haut' | 'bas' }

const props = defineProps<{ selection: SelectionDev | null; flags: FlagPage[]; alertes: AlerteDev[]; occupe: boolean; blocs: BlocDev[] }>()
const emit = defineEmits<{
  operation: [o: OperationDev, confirmer?: string]
  selectionner: [chemin: number[]]
  fermer: []
  glisser: [id: string]
  'fin-glisser': []
  inserer: [id: string]
  enregistrer: [nom: string]
  'supprimer-bloc': [bloc: BlocDev]
}>()

const onglet = ref<'element' | 'blocs' | 'flags'>('element')

// ---------- bibliothèque de sections ----------
const blocsFournis = computed(() => props.blocs.filter((b) => !b.perso))
const blocsPerso = computed(() => props.blocs.filter((b) => b.perso))
function debutGlisser(e: DragEvent, b: BlocDev) {
  e.dataTransfer?.setData('text/plain', `bifrost-bloc:${b.id}`)
  if (e.dataTransfer) e.dataTransfer.effectAllowed = 'copy'
  emit('glisser', b.id)
}
const nomBloc = ref<string | null>(null)
function enregistrerBloc() {
  const n = nomBloc.value?.trim()
  if (!n) return
  emit('enregistrer', n)
  nomBloc.value = null
}

// ---------- formulaire de l'élément ----------
const f = ref({ cle: '', type: '', liste: '', limite: '', element: false, modele: '', texte: '', alt: '', href: '', title: '' })
function remplir(s: SelectionDev | null) {
  if (!s) return
  const g = (n: string) => (typeof s.flags[n] === 'string' ? s.flags[n] as string : '')
  f.value = {
    cle: g('data-bf'), type: g('data-bf-type'), liste: g('data-bf-liste'), limite: g('data-bf-limite'),
    element: !!s.flags['data-bf-element'], modele: g('data-bf-page'),
    texte: s.texte, alt: s.attributs.alt ?? '', href: s.attributs.href ?? '', title: s.attributs.title ?? '',
  }
}
watch(() => props.selection, (s) => { remplir(s); if (s) onglet.value = 'element' }, { immediate: true })

const s = computed(() => props.selection)
const aFlag = computed(() => !!s.value && typeof s.value.flags['data-bf'] === 'string')
const flagsModifies = computed(() => {
  const x = s.value
  if (!x) return false
  const g = (n: string) => (typeof x.flags[n] === 'string' ? x.flags[n] : '')
  return f.value.cle.trim() !== g('data-bf') || f.value.type !== g('data-bf-type') || f.value.liste.trim() !== g('data-bf-liste')
    || f.value.limite.trim() !== g('data-bf-limite') || f.value.element !== !!x.flags['data-bf-element'] || f.value.modele.trim() !== g('data-bf-page')
})
const typeDevine = computed(() => {
  const b = s.value?.balise
  return b === 'img' ? 'image' : b === 'a' ? 'lien' : 'texte'
})
const nomValide = (v: string) => !v.trim() || /^[\w][\w.-]{0,99}$/.test(v.trim())
const formulaireValide = computed(() => nomValide(f.value.cle) && nomValide(f.value.liste) && nomValide(f.value.modele)
  && (!f.value.limite.trim() || /^[1-9]\d{0,2}$/.test(f.value.limite.trim())))

function proposer() {
  if (!s.value) return
  f.value.cle = s.value.suggestion.cle
  if (s.value.suggestion.type === 'riche') f.value.type = 'riche'
}
function appliquerFlags() {
  if (!formulaireValide.value) return
  const v = (x: string) => x.trim() || null
  emit('operation', { op: 'flags', flags: {
    'data-bf': v(f.value.cle),
    'data-bf-type': f.value.cle.trim() ? (f.value.type || null) : null,
    'data-bf-liste': v(f.value.liste),
    'data-bf-limite': f.value.liste.trim() && f.value.limite.trim() ? parseInt(f.value.limite, 10) : null,
    'data-bf-element': f.value.element,
    'data-bf-page': v(f.value.modele),
  } })
}
function retirerFlags() {
  emit('operation', { op: 'flags', flags: { 'data-bf': null, 'data-bf-type': null, 'data-bf-liste': null, 'data-bf-limite': null, 'data-bf-element': false, 'data-bf-page': null } })
}
function appliquerTexte() {
  if (s.value && f.value.texte.trim() !== s.value.texte) emit('operation', { op: 'texte', valeur: f.value.texte })
}
function appliquerAttribut(nom: 'alt' | 'href' | 'title') {
  const avant = s.value?.attributs[nom] ?? ''
  if (f.value[nom].trim() === avant) return
  emit('operation', { op: 'attribut', nom, valeur: f.value[nom].trim() || (nom === 'alt' ? '' : null) })
}
function parent(i: number) {
  if (s.value) emit('selectionner', s.value.chemin.slice(0, i + 1))
}

// ---------- flags de la page ----------
const resume = (fl: Record<string, string | boolean>) => {
  const morceaux: string[] = []
  if (fl['data-bf-liste']) morceaux.push(`liste ${fl['data-bf-liste']}${fl['data-bf-limite'] ? ` (${fl['data-bf-limite']} max)` : ''}`)
  if (fl['data-bf-element']) morceaux.push('élément')
  if (typeof fl['data-bf'] === 'string') morceaux.push(`${fl['data-bf'] || '(sans nom)'}${fl['data-bf-type'] ? ` · ${fl['data-bf-type']}` : ''}`)
  if (fl['data-bf-page']) morceaux.push(`modèle de ${fl['data-bf-page']}`)
  if (fl['data-bf-formulaire']) morceaux.push(`formulaire ${fl['data-bf-formulaire']}`)
  return morceaux.join(' · ')
}
const memeChemin = (a: number[] | null | undefined, b: number[]) => !!a && a.length === b.length && a.every((x, i) => x === b[i])
</script>

<template>
  <aside class="pd" aria-label="Mode dev">
    <div class="pd-onglets" role="tablist">
      <button type="button" role="tab" :aria-selected="onglet === 'element'" @click="onglet = 'element'">Élément</button>
      <button type="button" role="tab" :aria-selected="onglet === 'blocs'" @click="onglet = 'blocs'">Blocs</button>
      <button type="button" role="tab" :aria-selected="onglet === 'flags'" title="Flags de la page" @click="onglet = 'flags'">
        Flags <span class="pd-compte">{{ flags.length }}</span><span v-if="alertes.length" class="pd-compte pd-compte--alerte" :title="`${alertes.length} point(s) à vérifier`">⚠ {{ alertes.length }}</span>
      </button>
      <button type="button" class="pd-fermer" aria-label="Quitter le mode dev" title="Quitter le mode dev" @click="emit('fermer')">✕</button>
    </div>

    <!-- Élément sélectionné -->
    <div v-if="onglet === 'element'" class="pd-corps">
      <p v-if="!s" class="pd-vide">
        Cliquez sur n’importe quel élément de la page pour le sélectionner.<br>
        <kbd>Double-clic</kbd> ou <kbd>Entrée</kbd> : modifier le texte · <kbd>Échap</kbd> : élément parent · <kbd>Suppr</kbd> : supprimer
      </p>
      <template v-else>
        <nav class="pd-fil" aria-label="Position dans la page">
          <template v-for="(b, i) in s.fil" :key="i">
            <button type="button" :class="{ 'pd-fil-actif': i === s.fil.length - 1 }" @click="parent(i)">{{ b }}</button><span v-if="i < s.fil.length - 1" aria-hidden="true">›</span>
          </template>
        </nav>

        <div class="pd-actions">
          <button type="button" :disabled="!s.peutMonter || occupe" title="Monter (avant l’élément précédent)" @click="emit('operation', { op: 'deplacer', sens: 'haut' })">↑</button>
          <button type="button" :disabled="!s.peutDescendre || occupe" title="Descendre" @click="emit('operation', { op: 'deplacer', sens: 'bas' })">↓</button>
          <button type="button" :disabled="occupe" title="Dupliquer" @click="emit('operation', { op: 'dupliquer' })">⧉ Dupliquer</button>
          <button type="button" class="pd-danger" :disabled="occupe" title="Supprimer" @click="emit('operation', { op: 'supprimer' }, `Supprimer cet élément <${s.balise}> et tout ce qu’il contient ?`)">✕ Supprimer</button>
          <button v-if="nomBloc === null" type="button" :disabled="occupe" title="Réutiliser cet élément dans d’autres pages ou d’autres sites" @click="nomBloc = ''">⭐ Enregistrer comme bloc</button>
        </div>
        <form v-if="nomBloc !== null" class="pd-ligne" @submit.prevent="enregistrerBloc">
          <input v-model="nomBloc" class="pd-saisie" maxlength="60" placeholder="Nom du bloc" aria-label="Nom du bloc" autofocus>
          <button type="submit" class="pd-petit" :disabled="!nomBloc.trim() || occupe">Enregistrer</button>
          <button type="button" class="pd-petit" @click="nomBloc = null">Annuler</button>
        </form>
        <p class="pd-note">Astuce : glissez l’élément sélectionné dans la page pour le déplacer.</p>

        <p v-if="s.contexte.dansRiche" class="pd-note pd-note--alerte">Cet élément est dans un texte riche : ses flags seraient ignorés.</p>

        <section class="pd-bloc">
          <h3>Champ modifiable par le client</h3>
          <label class="pd-champ">
            <span>Clé <small>data-bf</small></span>
            <span class="pd-ligne">
              <input v-model="f.cle" :placeholder="s.suggestion.cle" spellcheck="false" :aria-invalid="!nomValide(f.cle)" @keydown.enter.prevent="appliquerFlags">
              <button type="button" class="pd-petit" title="Proposer une clé" @click="proposer">Proposer</button>
            </span>
          </label>
          <p v-if="s.contexte.dansElement && f.cle" class="pd-note">Dans un élément de liste : la clé est propre à chaque élément (« titre », « photo »…).</p>
          <p v-else-if="f.cle && !s.contexte.dansElement" class="pd-note">Hors liste : la clé est partagée par toutes les pages où elle apparaît.</p>
          <label v-if="f.cle" class="pd-champ">
            <span>Type <small>data-bf-type</small></span>
            <select v-model="f.type">
              <option value="">Deviné ({{ typeDevine }})</option>
              <option value="texte">Texte simple</option>
              <option value="riche">Texte mis en forme</option>
              <option value="image">Image</option>
              <option value="lien">Lien</option>
            </select>
          </label>
        </section>

        <section class="pd-bloc">
          <h3>Listes et collections</h3>
          <label class="pd-champ">
            <span>Liste répétable <small>data-bf-liste</small></span>
            <input v-model="f.liste" placeholder="ex. actualites" spellcheck="false" :aria-invalid="!nomValide(f.liste)">
          </label>
          <label v-if="f.liste.trim()" class="pd-champ">
            <span>N’afficher que les premiers <small>data-bf-limite</small></span>
            <input v-model="f.limite" inputmode="numeric" placeholder="tous" :aria-invalid="!!f.limite.trim() && !/^[1-9]\d{0,2}$/.test(f.limite.trim())">
          </label>
          <label class="pd-case">
            <input v-model="f.element" type="checkbox">
            <span>Élément de liste <small>data-bf-element</small></span>
          </label>
          <p v-if="f.element && !s.contexte.liste && !f.liste" class="pd-note pd-note--alerte">Aucune liste autour : posez « Liste répétable » sur un parent.</p>
          <label class="pd-champ">
            <span>Page modèle de la collection <small>data-bf-page</small></span>
            <input v-model="f.modele" placeholder="ex. actualites" spellcheck="false" :aria-invalid="!nomValide(f.modele)">
          </label>
        </section>

        <div class="pd-boutons">
          <button v-if="aFlag || s.flags['data-bf-liste'] || s.flags['data-bf-element'] || s.flags['data-bf-page']" type="button" class="pd-btn pd-btn--clair" :disabled="occupe" @click="retirerFlags">Retirer les flags</button>
          <button type="button" class="pd-btn" :disabled="!flagsModifies || !formulaireValide || occupe" @click="appliquerFlags">Appliquer</button>
        </div>

        <section v-if="s.feuille || s.balise === 'img' || s.balise === 'a'" class="pd-bloc">
          <h3>Contenu</h3>
          <label v-if="s.feuille" class="pd-champ">
            <span>Texte</span>
            <textarea v-model="f.texte" rows="3" @blur="appliquerTexte" />
          </label>
          <label v-if="s.balise === 'img'" class="pd-champ">
            <span>Texte alternatif <small>alt</small></span>
            <input v-model="f.alt" placeholder="Décrire la photo (vide = décorative)" @blur="appliquerAttribut('alt')" @keydown.enter.prevent="appliquerAttribut('alt')">
          </label>
          <p v-if="s.balise === 'img' && s.attributs.src" class="pd-note pd-mono">{{ s.attributs.src }}</p>
          <label v-if="s.balise === 'a'" class="pd-champ">
            <span>Adresse du lien <small>href</small></span>
            <input v-model="f.href" spellcheck="false" @blur="appliquerAttribut('href')" @keydown.enter.prevent="appliquerAttribut('href')">
          </label>
          <label v-if="s.balise === 'a' || s.balise === 'img'" class="pd-champ">
            <span>Info-bulle <small>title</small></span>
            <input v-model="f.title" @blur="appliquerAttribut('title')" @keydown.enter.prevent="appliquerAttribut('title')">
          </label>
        </section>
      </template>
    </div>

    <!-- Bibliothèque de sections -->
    <div v-else-if="onglet === 'blocs'" class="pd-corps">
      <p class="pd-note pd-note--haut">Glissez une section dans la page, ou cliquez pour l’ajouter {{ s ? 'après l’élément sélectionné' : 'à la fin de la page' }}. Les flags sont déjà posés.</p>
      <ul class="pd-blocs">
        <li v-for="b in blocsFournis" :key="b.id">
          <button type="button" class="pd-bloc-carte" draggable="true" :disabled="occupe" :title="b.description"
            @dragstart="debutGlisser($event, b)" @dragend="emit('fin-glisser')" @click="emit('inserer', b.id)">
            <span class="pd-bloc-icone" aria-hidden="true">{{ b.icone }}</span>
            <strong>{{ b.nom }}</strong>
            <small>{{ b.description }}</small>
          </button>
        </li>
      </ul>
      <h3 class="pd-titre">Mes blocs</h3>
      <p v-if="!blocsPerso.length" class="pd-note">Sélectionnez une section d’un site, puis « ⭐ Enregistrer comme bloc » pour la réutiliser partout.</p>
      <ul v-else class="pd-blocs">
        <li v-for="b in blocsPerso" :key="b.id" class="pd-bloc-perso">
          <button type="button" class="pd-bloc-carte" draggable="true" :disabled="occupe" :title="b.description || b.nom"
            @dragstart="debutGlisser($event, b)" @dragend="emit('fin-glisser')" @click="emit('inserer', b.id)">
            <span class="pd-bloc-icone" aria-hidden="true">{{ b.icone }}</span>
            <strong>{{ b.nom }}</strong>
          </button>
          <button type="button" class="pd-bloc-suppr" :aria-label="`Supprimer le bloc ${b.nom}`" title="Supprimer ce bloc" @click="emit('supprimer-bloc', b)">✕</button>
        </li>
      </ul>
    </div>

    <!-- Tous les flags de la page -->
    <div v-else class="pd-corps">
      <ul v-if="alertes.length" class="pd-alertes">
        <li v-for="(a, i) in alertes" :key="i"><button type="button" @click="emit('selectionner', a.chemin)">⚠ {{ a.texte }}</button></li>
      </ul>
      <p v-if="!flags.length" class="pd-vide">Aucun flag sur cette page. Sélectionnez un élément et donnez-lui une clé.</p>
      <ul class="pd-liste">
        <li v-for="(x, i) in flags" :key="i" :style="{ paddingLeft: `${Math.min(x.profondeur, 8) * 8}px` }">
          <button type="button" :class="{ 'pd-ignore': x.ignore, 'pd-fil-actif': memeChemin(s?.chemin, x.chemin) }" @click="emit('selectionner', x.chemin)">
            <code>&lt;{{ x.balise }}&gt;</code> {{ resume(x.flags) }}
          </button>
        </li>
      </ul>
    </div>
  </aside>
</template>

<style scoped>
.pd { width: 340px; flex: none; display: flex; flex-direction: column; min-height: 0; background: var(--bf-surface); backdrop-filter: blur(18px); border-left: 1px solid var(--bf-bord); font-size: 13px; }
.pd-onglets { display: flex; align-items: center; gap: 4px; padding: 8px; border-bottom: 1px solid var(--bf-bord); }
.pd-onglets button { border: 0; background: none; color: var(--bf-doux); font: inherit; font-weight: 600; padding: 7px 10px; border-radius: 999px; cursor: pointer; display: inline-flex; gap: 6px; align-items: center; white-space: nowrap; }
.pd-onglets button[aria-selected='true'] { background: var(--bf-verre-fort); color: var(--bf-fort); }
.pd-onglets .pd-fermer { margin-left: auto; }
.pd-compte { font-size: 11px; padding: 1px 6px; border-radius: 999px; background: var(--bf-verre-fort); }
.pd-compte--alerte { background: rgba(224, 122, 74, .25); color: var(--bf-accent); }
.pd-corps { flex: 1; overflow: auto; padding: 12px 14px 20px; display: grid; gap: 12px; align-content: start; }
.pd-vide { margin: 8px 0; color: var(--bf-doux); line-height: 1.7; }
kbd { font: 600 11px ui-monospace, Consolas, monospace; padding: 1px 5px; border-radius: 5px; background: var(--bf-verre-fort); border: 1px solid var(--bf-bord); }
.pd-fil { display: flex; flex-wrap: wrap; gap: 2px; align-items: center; font-family: ui-monospace, Consolas, monospace; font-size: 12px; color: var(--bf-pale); }
.pd-fil button { border: 0; background: none; color: var(--bf-doux); font: inherit; padding: 2px 4px; border-radius: 5px; cursor: pointer; }
.pd-fil button:hover { background: var(--bf-verre-fort); color: var(--bf-fort); }
.pd-fil-actif { color: var(--bf-violet) !important; font-weight: 700 !important; }
.pd-actions { display: flex; gap: 6px; flex-wrap: wrap; }
.pd-actions button, .pd-petit { border: 0; border-radius: 999px; padding: 6px 11px; background: var(--bf-verre-fort); box-shadow: inset 0 0 0 1px var(--bf-bord); color: var(--bf-texte); font: inherit; font-weight: 600; cursor: pointer; white-space: nowrap; }
.pd-actions button:hover:not(:disabled), .pd-petit:hover { background: var(--bf-survol); }
.pd-actions button:disabled { opacity: .4; cursor: default; }
.pd-actions .pd-danger { color: var(--bf-danger); }
.pd-bloc { display: grid; gap: 10px; padding: 12px; border-radius: 14px; background: var(--bf-verre); border: 1px solid var(--bf-bord); }
.pd-bloc h3 { margin: 0; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; color: var(--bf-doux); }
.pd-champ { display: grid; gap: 5px; font-weight: 600; color: var(--bf-texte); }
.pd-champ small, .pd-case small { font: 500 11px ui-monospace, Consolas, monospace; color: var(--bf-pale); margin-left: 4px; }
.pd-champ input, .pd-champ select, .pd-champ textarea { width: 100%; min-width: 0; background: var(--bf-champ); border: 1px solid var(--bf-bord-fort); border-radius: 9px; padding: 8px 10px; color: var(--bf-texte); font: inherit; font-weight: 400; }
.pd-champ input[aria-invalid='true'] { border-color: var(--bf-danger); }
.pd-champ select option { background: var(--bf-fond); color: var(--bf-texte); }
.pd-ligne { display: flex; gap: 6px; }
.pd-case { display: flex; gap: 8px; align-items: center; font-weight: 600; cursor: pointer; }
.pd-note { margin: -4px 0 0; font-size: 12px; color: var(--bf-doux); }
.pd-note--alerte { color: var(--bf-accent); margin: 0; }
.pd-mono { font-family: ui-monospace, Consolas, monospace; word-break: break-all; }
.pd-boutons { display: flex; justify-content: flex-end; gap: 6px; flex-wrap: wrap; }
.pd-btn { border: 0; border-radius: 999px; padding: 8px 16px; font: inherit; font-weight: 700; cursor: pointer; background: var(--bf-degrade); color: #fff; }
.pd-btn:disabled { opacity: .45; cursor: default; }
.pd-btn--clair { background: var(--bf-verre-fort); color: var(--bf-texte); box-shadow: inset 0 0 0 1px var(--bf-bord); }
.pd-alertes, .pd-liste { list-style: none; margin: 0; padding: 0; display: grid; gap: 2px; }
.pd-alertes button, .pd-liste button { width: 100%; text-align: left; border: 0; background: none; color: var(--bf-texte); font: inherit; padding: 6px 8px; border-radius: 8px; cursor: pointer; }
.pd-alertes button { color: var(--bf-accent); background: rgba(224, 122, 74, .08); }
.pd-alertes button:hover, .pd-liste button:hover { background: var(--bf-verre-fort); }
.pd-liste code { font-size: 11px; color: var(--bf-pale); }
.pd-saisie { flex: 1; min-width: 0; background: var(--bf-champ); border: 1px solid var(--bf-bord-fort); border-radius: 9px; padding: 7px 10px; color: var(--bf-texte); font: inherit; }
.pd-note--haut { margin: 0; }
.pd-titre { margin: 6px 0 0; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; color: var(--bf-doux); }
.pd-blocs { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.pd-bloc-carte { width: 100%; height: 100%; display: grid; gap: 3px; align-content: start; justify-items: start; text-align: left; padding: 10px; border: 1px solid var(--bf-bord); border-radius: 12px; background: var(--bf-verre); color: var(--bf-texte); font: inherit; cursor: grab; }
.pd-bloc-carte:hover:not(:disabled) { background: var(--bf-verre-fort); border-color: rgba(139, 92, 246, .5); }
.pd-bloc-carte:active { cursor: grabbing; }
.pd-bloc-carte small { font-size: 11px; color: var(--bf-doux); line-height: 1.35; }
.pd-bloc-icone { font-size: 20px; }
.pd-bloc-perso { position: relative; }
.pd-bloc-suppr { position: absolute; top: 4px; right: 4px; border: 0; background: none; color: var(--bf-doux); cursor: pointer; border-radius: 999px; width: 24px; height: 24px; }
.pd-bloc-suppr:hover { color: var(--bf-danger); background: var(--bf-verre-fort); }
.pd-ignore { opacity: .5; text-decoration: line-through; }
@media (max-width: 900px) {
  .pd { position: fixed; left: 0; right: 0; bottom: 0; width: auto; max-height: 48vh; border-left: 0; border-top: 1px solid var(--bf-bord); border-radius: 18px 18px 0 0; z-index: 20; box-shadow: 0 -16px 40px rgba(0, 0, 0, .35); }
}
</style>
