<script setup lang="ts">
/**
 * Mode dev : panneau à côté de l'aperçu. Montre l'élément sélectionné dans la page
 * (fil d'Ariane, texte, flags, attributs) et la liste de tous les flags de la page.
 * Le panneau n'appelle pas l'API : il émet des opérations que l'éditeur envoie au serveur.
 */
import { computed, ref, watch } from 'vue'
import type { BlocDev, ThemeDev, VariableTheme } from '@/services/editeur.service'

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
  | { op: 'attribut'; nom: 'alt' | 'href' | 'title' | 'class'; valeur: string | null }
  | { op: 'supprimer' }
  | { op: 'dupliquer' }
  | { op: 'deplacer'; sens: 'haut' | 'bas' }

const props = defineProps<{ selection: SelectionDev | null; flags: FlagPage[]; alertes: AlerteDev[]; occupe: boolean; blocs: BlocDev[]; theme: ThemeDev | null; pages: string[]; page: string }>()
const emit = defineEmits<{
  operation: [o: OperationDev, confirmer?: string]
  selectionner: [chemin: number[]]
  fermer: []
  glisser: [id: string]
  'fin-glisser': []
  inserer: [id: string]
  rubrique: [mode: 'rubrique' | 'fil']
  enregistrer: [nom: string]
  'supprimer-bloc': [bloc: BlocDev]
  'theme-charger': []
  'theme-apercu': [nom: string, valeur: string | null]
  'theme-enregistrer': [modifs: { fichier: string; nom: string; valeur: string }[]]
  'page-ouvrir': [page: string]
  'page-creer': [b: { titre: string; chemin: string; depuis: string; menu: boolean }]
  'page-renommer': [page: string, nouveau: string]
  'page-supprimer': [page: string]
}>()

const onglet = ref<'element' | 'blocs' | 'theme' | 'pages' | 'flags'>('element')
watch(onglet, (o) => { if (o === 'theme') emit('theme-charger') })

// ---------- thème ----------
// valeurs en cours de modification, par « fichier|nom »
const brouillonTheme = ref<Record<string, string>>({})
const cleVar = (v: { fichier: string; nom: string }) => `${v.fichier}|${v.nom}`
const valeurVar = (v: VariableTheme) => brouillonTheme.value[cleVar(v)] ?? v.valeur
const themeModifie = computed(() => Object.keys(brouillonTheme.value).length)
const groupesSite = computed(() => {
  const g = new Map<string, VariableTheme[]>()
  for (const v of props.theme?.site ?? []) g.set(v.fichier, [...(g.get(v.fichier) ?? []), v])
  return [...g.entries()]
})
watch(() => props.theme, () => { brouillonTheme.value = {} })
function changerVar(v: VariableTheme, valeur: string) {
  const k = cleVar(v)
  const copie = { ...brouillonTheme.value }
  if (valeur === v.valeur) delete copie[k]; else copie[k] = valeur
  brouillonTheme.value = copie
  emit('theme-apercu', v.nom, valeur.trim() || null)
}
/** Une couleur que le sélecteur sait afficher (#rgb ou #rrggbb). */
function hexDe(valeur: string): string | null {
  const v = valeur.trim()
  if (/^#[0-9a-f]{6}$/i.test(v)) return v.toLowerCase()
  if (/^#[0-9a-f]{3}$/i.test(v)) return `#${v.slice(1).split('').map((c) => c + c).join('')}`.toLowerCase()
  if (/^(white|#fff)$/i.test(v)) return '#ffffff'
  if (/^black$/i.test(v)) return '#000000'
  return null
}
function annulerTheme() {
  for (const k of Object.keys(brouillonTheme.value)) {
    const [fichier, nom] = k.split('|')
    const v = [...(props.theme?.site ?? []), ...(props.theme?.bifrost ?? [])].find((x) => x.fichier === fichier && x.nom === nom)
    emit('theme-apercu', nom as string, v?.valeur ?? null)
  }
  brouillonTheme.value = {}
}
function enregistrerTheme() {
  const modifs = Object.entries(brouillonTheme.value).map(([k, valeur]) => {
    const [fichier, nom] = k.split('|')
    return { fichier: fichier as string, nom: nom as string, valeur }
  }).filter((m) => m.valeur.trim())
  if (modifs.length) emit('theme-enregistrer', modifs)
}

// ---------- pages du site ----------
/** Pages principales, puis un dossier par collection (actualités…) replié. */
const pagesRacine = computed(() => props.pages.filter((p) => !p.includes('/')))
const dossiersPages = computed(() => {
  const g = new Map<string, string[]>()
  for (const p of props.pages) if (p.includes('/')) { const d = p.slice(0, p.lastIndexOf('/')); g.set(d, [...(g.get(d) ?? []), p]) }
  return [...g.entries()]
})
const slug = (t: string) => t.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60)
const nouvelle = ref<{ titre: string; chemin: string; cheminTouche: boolean; depuis: string; menu: boolean } | null>(null)
function ouvrirNouvelle() { nouvelle.value = { titre: '', chemin: '', cheminTouche: false, depuis: props.page.includes('/') ? 'index.html' : props.page, menu: true } }
watch(() => nouvelle.value?.titre, (t) => { const n = nouvelle.value; if (n && !n.cheminTouche) n.chemin = t ? `${slug(t) || 'page'}.html` : '' })
function creerPage() {
  const n = nouvelle.value
  if (!n?.titre.trim() || !n.chemin.trim()) return
  emit('page-creer', { titre: n.titre.trim(), chemin: n.chemin.trim(), depuis: n.depuis, menu: n.menu })
  nouvelle.value = null
}
const renommage = ref<{ page: string; nom: string } | null>(null)
function renommer() {
  const r = renommage.value
  if (!r) return
  let nom = r.nom.trim().toLowerCase()
  if (nom && !nom.endsWith('.html')) nom += '.html'
  if (nom && nom !== r.page) emit('page-renommer', r.page, nom)
  renommage.value = null
}

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
const f = ref({ cle: '', type: '', liste: '', limite: '', element: false, modele: '', texte: '', alt: '', href: '', title: '', classes: '' })
function remplir(s: SelectionDev | null) {
  if (!s) return
  const g = (n: string) => (typeof s.flags[n] === 'string' ? s.flags[n] as string : '')
  f.value = {
    cle: g('data-bf'), type: g('data-bf-type'), liste: g('data-bf-liste'), limite: g('data-bf-limite'),
    element: !!s.flags['data-bf-element'], modele: g('data-bf-page'),
    texte: s.texte, alt: s.attributs.alt ?? '', href: s.attributs.href ?? '', title: s.attributs.title ?? '', classes: s.attributs.class ?? '',
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
function appliquerAttribut(nom: 'alt' | 'href' | 'title' | 'class') {
  const avant = s.value?.attributs[nom] ?? ''
  const champ = nom === 'class' ? 'classes' : nom
  const v = f.value[champ].trim().replace(/\s+/g, ' ')
  if (v === avant) return
  emit('operation', { op: 'attribut', nom, valeur: v || (nom === 'alt' ? '' : null) })
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
      <button type="button" role="tab" :aria-selected="onglet === 'theme'" @click="onglet = 'theme'">Thème</button>
      <button type="button" role="tab" :aria-selected="onglet === 'pages'" @click="onglet = 'pages'">Pages</button>
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

        <section class="pd-bloc">
          <h3>Contenu et style</h3>
          <label class="pd-champ">
            <span>Classes CSS <small>class</small></span>
            <input v-model="f.classes" spellcheck="false" placeholder="ex. section section--papier" :aria-invalid="!/^[\w\s-]*$/.test(f.classes)" @blur="appliquerAttribut('class')" @keydown.enter.prevent="appliquerAttribut('class')">
          </label>
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
        <li>
          <button type="button" class="pd-bloc-carte pd-bloc-carte--rubrique" :disabled="occupe" title="Une liste d’articles avec une page par article : blog, actualités, Instagram…" @click="emit('rubrique', 'rubrique')">
            <span class="pd-bloc-icone" aria-hidden="true">📰</span>
            <strong>Rubrique (blog…)</strong>
            <small>Articles avec leur page ; le client en ajoute avec « + »</small>
          </button>
        </li>
        <li>
          <button type="button" class="pd-bloc-carte pd-bloc-carte--rubrique" :disabled="occupe" title="Mélange les articles de plusieurs rubriques, du plus récent au plus ancien" @click="emit('rubrique', 'fil')">
            <span class="pd-bloc-icone" aria-hidden="true">🧵</span>
            <strong>Fil</strong>
            <small>Plusieurs rubriques mélangées, triées par date</small>
          </button>
        </li>
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

    <!-- Thème : variables CSS -->
    <div v-else-if="onglet === 'theme'" class="pd-corps">
      <p v-if="!theme" class="pd-vide">Chargement…</p>
      <template v-else>
        <p class="pd-note pd-note--haut">Les changements s’affichent tout de suite dans l’aperçu ; « Enregistrer » les écrit dans le brouillon.</p>
        <section v-for="[fichier, vars] in groupesSite" :key="fichier" class="pd-bloc">
          <h3>Variables du site <small class="pd-mono">{{ fichier }}</small></h3>
          <label v-for="v in vars" :key="v.nom" class="pd-var">
            <span class="pd-mono">{{ v.nom }}</span>
            <span class="pd-ligne">
              <input v-if="hexDe(valeurVar(v))" type="color" class="pd-couleur" :value="hexDe(valeurVar(v))" :aria-label="`Couleur ${v.nom}`" @input="changerVar(v, ($event.target as HTMLInputElement).value)">
              <input class="pd-saisie" :value="valeurVar(v)" spellcheck="false" :class="{ 'pd-modifie': brouillonTheme[cleVar(v)] !== undefined }" @input="changerVar(v, ($event.target as HTMLInputElement).value)">
            </span>
          </label>
        </section>
        <p v-if="!groupesSite.length" class="pd-note">Aucune variable « :root { --… } » dans les feuilles du site.</p>
        <section class="pd-bloc">
          <h3>Sections Bifrost</h3>
          <p class="pd-note">Valeurs utilisées par les blocs ajoutés. On peut reprendre une couleur du site : <code>var(--vert)</code>.</p>
          <label v-for="v in theme.bifrost" :key="v.nom" class="pd-var">
            <span>{{ v.libelle }} <small class="pd-mono">{{ v.nom }}</small></span>
            <span class="pd-ligne">
              <input v-if="hexDe(valeurVar(v))" type="color" class="pd-couleur" :value="hexDe(valeurVar(v))" :aria-label="`Couleur ${v.libelle}`" @input="changerVar(v, ($event.target as HTMLInputElement).value)">
              <input class="pd-saisie" :value="valeurVar(v)" :placeholder="v.defaut" spellcheck="false" :class="{ 'pd-modifie': brouillonTheme[cleVar(v)] !== undefined }" @input="changerVar(v, ($event.target as HTMLInputElement).value)">
            </span>
          </label>
        </section>
        <div class="pd-boutons pd-boutons--colle">
          <button v-if="themeModifie" type="button" class="pd-btn pd-btn--clair" :disabled="occupe" @click="annulerTheme">Annuler</button>
          <button type="button" class="pd-btn" :disabled="!themeModifie || occupe" @click="enregistrerTheme">Enregistrer{{ themeModifie ? ` (${themeModifie})` : '' }}</button>
        </div>
      </template>
    </div>

    <!-- Pages du site -->
    <div v-else-if="onglet === 'pages'" class="pd-corps">
      <p class="pd-note pd-note--haut">Une nouvelle page reprend l’en-tête, le menu et le pied de page d’une page existante. Renommer fait suivre tous les liens du site.</p>
      <ul class="pd-pages">
        <li v-for="p in pagesRacine" :key="p" :class="{ 'pd-page-active': p === page }">
          <template v-if="renommage?.page === p">
            <input v-model="renommage.nom" class="pd-saisie pd-mono" aria-label="Nouveau nom de la page" spellcheck="false"
              @keydown.enter.prevent="renommer" @keydown.esc.prevent="renommage = null">
            <button type="button" class="pd-mini" :disabled="occupe" title="Valider" @click="renommer">✓</button>
          </template>
          <template v-else>
            <button type="button" class="pd-page-nom" @click="emit('page-ouvrir', p)"><span class="pd-mono">{{ p }}</span></button>
            <button v-if="p !== 'index.html'" type="button" class="pd-mini" :disabled="occupe" :aria-label="`Renommer ${p}`" title="Renommer" @click="renommage = { page: p, nom: p }">✎</button>
            <button v-if="p !== 'index.html'" type="button" class="pd-mini" :disabled="occupe" :aria-label="`Supprimer ${p}`" title="Supprimer" @click="emit('page-supprimer', p)">✕</button>
          </template>
        </li>
      </ul>
      <p v-for="[d, ps] in dossiersPages" :key="d" class="pd-note"><span class="pd-mono">{{ d }}/</span> : {{ ps.length }} page{{ ps.length > 1 ? 's' : '' }} (gérées avec leur liste)</p>
      <button v-if="!nouvelle" type="button" class="pd-btn" :disabled="occupe" @click="ouvrirNouvelle">+ Nouvelle page</button>
      <section v-else class="pd-bloc">
        <h3>Nouvelle page</h3>
        <label class="pd-champ">Titre <input v-model="nouvelle.titre" class="pd-saisie" placeholder="Nos tarifs" @keydown.enter.prevent="creerPage"></label>
        <label class="pd-champ">Fichier <input v-model="nouvelle.chemin" class="pd-saisie pd-mono" spellcheck="false" placeholder="nos-tarifs.html" @input="nouvelle.cheminTouche = true"></label>
        <label class="pd-champ">Reprendre la mise en page de
          <select v-model="nouvelle.depuis" class="pd-saisie"><option v-for="p in pagesRacine" :key="p" :value="p">{{ p }}</option></select>
        </label>
        <label class="pd-case"><input v-model="nouvelle.menu" type="checkbox"> Ajouter au menu de toutes les pages</label>
        <div class="pd-boutons">
          <button type="button" class="pd-btn pd-btn--clair" @click="nouvelle = null">Annuler</button>
          <button type="button" class="pd-btn" :disabled="occupe || !nouvelle.titre.trim() || !nouvelle.chemin.trim()" @click="creerPage">Créer la page</button>
        </div>
      </section>
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
.pd-onglets button { border: 0; background: none; color: var(--bf-doux); font: inherit; font-weight: 600; padding: 7px 8px; border-radius: 999px; cursor: pointer; display: inline-flex; gap: 6px; align-items: center; white-space: nowrap; }
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
.pd-bloc-carte--rubrique { cursor: pointer; border-color: rgba(139, 92, 246, .35); }
.pd-bloc-carte small { font-size: 11px; color: var(--bf-doux); line-height: 1.35; }
.pd-bloc-icone { font-size: 20px; }
.pd-bloc-perso { position: relative; }
.pd-bloc-suppr { position: absolute; top: 4px; right: 4px; border: 0; background: none; color: var(--bf-doux); cursor: pointer; border-radius: 999px; width: 24px; height: 24px; }
.pd-bloc-suppr:hover { color: var(--bf-danger); background: var(--bf-verre-fort); }
.pd-var { display: grid; gap: 4px; font-weight: 600; }
.pd-var small { font-weight: 500; font-size: 11px; color: var(--bf-pale); margin-left: 4px; }
.pd-couleur { flex: none; width: 38px; height: 34px; padding: 2px; border: 1px solid var(--bf-bord-fort); border-radius: 9px; background: var(--bf-champ); cursor: pointer; }
.pd-modifie { border-color: var(--bf-violet) !important; }
.pd-bloc h3 small { text-transform: none; letter-spacing: 0; }
.pd-pages { list-style: none; margin: 0 0 10px; padding: 0; display: grid; gap: 2px; }
.pd-pages li { display: flex; align-items: center; gap: 4px; border-radius: 9px; padding: 2px 4px; }
.pd-pages li:hover { background: var(--bf-verre); }
.pd-page-active { background: var(--bf-verre-fort); }
.pd-page-nom { flex: 1; min-width: 0; text-align: left; border: 0; background: none; color: var(--bf-texte); font: inherit; padding: 6px 4px; cursor: pointer; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pd-mini { border: 0; background: none; color: var(--bf-doux); font: inherit; width: 28px; height: 28px; border-radius: 8px; cursor: pointer; flex: none; }
.pd-mini:hover:not(:disabled) { background: var(--bf-verre-fort); color: var(--bf-fort); }
.pd-boutons--colle { position: sticky; bottom: -20px; padding: 10px 0; background: var(--bf-surface); }
.pd-ignore { opacity: .5; text-decoration: line-through; }
@media (max-width: 900px) {
  .pd { position: fixed; left: 0; right: 0; bottom: 0; width: auto; max-height: 48vh; border-left: 0; border-top: 1px solid var(--bf-bord); border-radius: 18px 18px 0 0; z-index: 20; box-shadow: 0 -16px 40px rgba(0, 0, 0, .35); }
}
</style>
