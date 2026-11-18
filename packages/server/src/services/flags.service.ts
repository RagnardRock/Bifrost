/**
 * Lecture et modification des flags Bifrost (data-bf) dans le HTML d'un site statique.
 *
 * Conventions (voir docs/flags.md) :
 * - data-bf="cle"            : un champ (texte, image, lien, texte riche selon la balise / data-bf-type)
 * - data-bf-liste="nom"      : une liste répétable ; chaque élément porte data-bf-element
 * - data-bf-limite="N"       : la liste n'affiche que les N premiers éléments
 * - data-bf-page="nom"       : la page sert de modèle pour les nouveaux éléments de la liste « nom »
 *
 * Ces fonctions sont pures (HTML en entrée, HTML en sortie) pour être faciles à tester.
 */
import * as cheerio from 'cheerio'
import type { CheerioAPI, Cheerio } from 'cheerio'
import type { Element } from 'domhandler'
import path from 'path'
import sanitizeHtml from 'sanitize-html'

export type TypeChamp = 'texte' | 'image' | 'lien' | 'riche'

export interface Champ {
  cle: string
  type: TypeChamp
  valeur: string
}

export interface Liste {
  nom: string
  limite: number | null
  elements: Champ[][]
}

export interface AnalysePage {
  champs: Champ[]
  listes: Liste[]
  modele: string | null
}

/** Balises autorisées dans un texte riche saisi par le client. */
const OPTIONS_RICHE: sanitizeHtml.IOptions = {
  allowedTags: ['p', 'br', 'strong', 'em', 'b', 'i', 'u', 'a', 'ul', 'ol', 'li', 'h2', 'h3', 'h4', 'blockquote'],
  allowedAttributes: { a: ['href'] },
  allowedSchemes: ['http', 'https', 'mailto', 'tel'],
}

export function nettoyerRiche(html: string): string {
  return sanitizeHtml(html, OPTIONS_RICHE)
}

export function charger(html: string): CheerioAPI {
  return cheerio.load(html)
}

export function typeDe($el: Cheerio<Element>): TypeChamp {
  const forcé = $el.attr('data-bf-type')
  if (forcé === 'riche' || forcé === 'texte' || forcé === 'image' || forcé === 'lien') return forcé
  const tag = $el.prop('tagName')?.toLowerCase()
  if (tag === 'img') return 'image'
  if (tag === 'a') return 'lien'
  return 'texte'
}

/** Cible réelle du texte : si l'élément ne contient qu'un lien, on modifie le texte du lien. */
function cibleTexte(_$: CheerioAPI, $el: Cheerio<Element>): Cheerio<Element> {
  const enfants = $el.children()
  if (enfants.length === 1 && enfants.first().is('a') && $el.text().trim() === enfants.first().text().trim()) {
    return enfants.first() as Cheerio<Element>
  }
  return $el
}

/** Un champ texte qui contient d'autres champs (ex. <summary>Titre<small data-bf>…</small></summary>) : on ne touche qu'à son texte propre. */
const contientChamps = ($el: Cheerio<Element>) => $el.find('[data-bf]').length > 0

function textePropre($el: Cheerio<Element>): string {
  return $el.contents().filter((_, n) => n.type === 'text').text().replace(/\s+/g, ' ').trim()
}

function ecrireTextePropre($: CheerioAPI, $el: Cheerio<Element>, valeur: string) {
  const textes = $el.contents().filter((_, n) => n.type === 'text' && !!$(n).text().trim())
  if (!textes.length) { $el.prepend(echapper(valeur)); return }
  textes.each((i, n) => { if (i === 0) (n as unknown as { data: string }).data = valeur; else $(n).remove() })
}
const echapper = (valeur: string) => valeur.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

function lireChamp($: CheerioAPI, $el: Cheerio<Element>, dossierPage: string): Champ {
  const type = typeDe($el)
  const cle = $el.attr('data-bf') || ''
  if (type === 'image') return { cle, type, valeur: versRacine($el.attr('src') || '', dossierPage) }
  if (type === 'riche') return { cle, type, valeur: ($el.html() || '').trim() }
  if (contientChamps($el)) return { cle, type, valeur: textePropre($el) }
  return { cle, type, valeur: cibleTexte($, $el).text().replace(/\s+/g, ' ').trim() }
}

/** Les éléments [data-bf] qui appartiennent directement à $racine (pas à une liste imbriquée). */
function champsDirects($: CheerioAPI, $racine: Cheerio<Element>, dansListe: boolean): Cheerio<Element> {
  const tous = $racine.find('[data-bf]').add($racine.filter('[data-bf]'))
  return tous.filter((_, el) => {
    const $el = $(el)
    // un champ riche contient parfois d'autres choses : on ne descend pas dedans
    if ($el.parents('[data-bf-type="riche"]').filter((_, p) => $racine.is(p) || (!!$racine[0] && $.contains($racine[0], p))).length) return false
    const liste = $el.closest('[data-bf-element]')
    if (!dansListe) return liste.length === 0
    return liste[0] === $racine[0]
  }) as Cheerio<Element>
}

export function analyser(html: string, cheminPage = 'index.html'): AnalysePage {
  const $ = charger(html)
  const dossier = path.posix.dirname(cheminPage)
  const vus = new Set<string>()
  const champs: Champ[] = []
  champsDirects($, $.root().children() as Cheerio<Element>, false).each((_, el) => {
    const c = lireChamp($, $(el) as Cheerio<Element>, dossier)
    if (!vus.has(c.cle)) { vus.add(c.cle); champs.push(c) }
  })
  const listes: Liste[] = []
  $('[data-bf-liste]').each((_, l) => {
    const $l = $(l)
    if ($l.parents('[data-bf-type="riche"]').length) return
    const elements: Champ[][] = []
    $l.find('[data-bf-element]').filter((_, e) => $(e).closest('[data-bf-liste]')[0] === l).each((_, e) => {
      const $e = $(e) as Cheerio<Element>
      const cs: Champ[] = []
      champsDirects($, $e, true).each((_, c) => { cs.push(lireChamp($, $(c) as Cheerio<Element>, dossier)) })
      elements.push(cs)
    })
    const lim = parseInt($l.attr('data-bf-limite') || '', 10)
    listes.push({ nom: $l.attr('data-bf-liste') || '', limite: Number.isFinite(lim) ? lim : null, elements })
  })
  return { champs, listes, modele: $('[data-bf-page]').first().attr('data-bf-page') || null }
}

// ---------- chemins ----------

/** Chemin relatif à la page -> chemin depuis la racine du site. Les URL absolues restent telles quelles. */
export function versRacine(url: string, dossierPage: string): string {
  if (!url || /^([a-z]+:|\/\/|#|\/)/i.test(url)) return url
  return path.posix.normalize(path.posix.join(dossierPage, url))
}

/** Chemin depuis la racine du site -> chemin relatif à la page. */
export function depuisRacine(url: string, dossierPage: string): string {
  if (!url || /^([a-z]+:|\/\/|#|\/)/i.test(url)) return url
  const r = path.posix.relative(dossierPage === '.' ? '' : dossierPage, url)
  return r || '.'
}

function reecrireUrls($: CheerioAPI, $el: Cheerio<Element>, de: string, vers: string) {
  if (de === vers) return
  $el.find('[src],[href]').add($el.filter('[src],[href]')).each((_, n) => {
    for (const attr of ['src', 'href']) {
      const v = $(n).attr(attr)
      if (v) $(n).attr(attr, depuisRacine(versRacine(v, de), vers))
    }
  })
}

// ---------- écriture ----------

function ecrireChamp($: CheerioAPI, $el: Cheerio<Element>, valeur: string, dossierPage: string) {
  const type = typeDe($el)
  if (type === 'image') { $el.attr('src', depuisRacine(valeur, dossierPage)); return }
  if (type === 'riche') { $el.html(nettoyerRiche(valeur)); return }
  if (contientChamps($el)) { ecrireTextePropre($, $el, valeur); return }
  const cible = cibleTexte($, $el)
  cible.text(valeur)
  if (cible.is('time') && /^\d{4}-\d{2}-\d{2}$/.test(valeur)) cible.attr('datetime', valeur)
}

/** Modifie un champ hors liste. Renvoie le HTML et le nombre d'éléments touchés. */
export function modifierChamp(html: string, cheminPage: string, cle: string, valeur: string): { html: string; touches: number } {
  const $ = charger(html)
  const dossier = path.posix.dirname(cheminPage)
  let touches = 0
  champsDirects($, $.root().children() as Cheerio<Element>, false)
    .filter((_, el) => $(el).attr('data-bf') === cle)
    .each((_, el) => { ecrireChamp($, $(el) as Cheerio<Element>, valeur, dossier); touches++ })
  return { html: $.html(), touches }
}

function elementsDe($: CheerioAPI, $l: Cheerio<Element>): Cheerio<Element> {
  return $l.find('[data-bf-element]').filter((_, e) => $(e).closest('[data-bf-liste]')[0] === $l[0]) as Cheerio<Element>
}

function listesNommees($: CheerioAPI, nom: string): Cheerio<Element> {
  return $(`[data-bf-liste="${nom.replace(/"/g, '')}"]`).filter((_, l) => !$(l).parents('[data-bf-type="riche"]').length) as Cheerio<Element>
}

export type OperationListe =
  | { op: 'modifier'; index: number; cle: string; valeur: string }
  | { op: 'supprimer'; index: number }
  | { op: 'deplacer'; index: number; vers: number }
  | { op: 'dupliquer'; index: number }

/** Applique une opération à toutes les listes « nom » de la page. */
export function operationListe(html: string, cheminPage: string, nom: string, o: OperationListe): { html: string; touches: number } {
  const $ = charger(html)
  const dossier = path.posix.dirname(cheminPage)
  let touches = 0
  listesNommees($, nom).each((_, l) => {
    const els = elementsDe($, $(l) as Cheerio<Element>)
    const $e = els.eq(o.index)
    if (!$e.length) return
    touches++
    if (o.op === 'modifier') {
      champsDirects($, $e, true).filter((_, c) => $(c).attr('data-bf') === o.cle)
        .each((_, c) => ecrireChamp($, $(c) as Cheerio<Element>, o.valeur, dossier))
    } else if (o.op === 'supprimer') {
      $e.remove()
    } else if (o.op === 'dupliquer') {
      $e.after($.html($e))
    } else if (o.op === 'deplacer') {
      const cible = Math.max(0, Math.min(els.length - 1, o.vers))
      if (cible === o.index) return
      const copie = $.html($e)
      $e.remove()
      const reste = elementsDe($, $(l) as Cheerio<Element>)
      if (cible >= reste.length) reste.last().after(copie)
      else reste.eq(cible).before(copie)
    }
  })
  return { html: $.html(), touches }
}

/** Renvoie le HTML de chaque élément d'une liste (chemins ramenés à la racine du site). */
export function elementsListe(html: string, cheminPage: string, nom: string): string[] {
  const $ = charger(html)
  const dossier = path.posix.dirname(cheminPage)
  const $l = listesNommees($, nom).filter((_, l) => !$(l).attr('data-bf-limite')).first() as Cheerio<Element>
  if (!$l.length) return []
  return elementsDe($, $l).toArray().map((e) => {
    const $c = $($.html(e)) as Cheerio<Element>
    reecrireUrls($, $c, dossier, '.')
    return $.html($c)
  })
}

/**
 * Rend une liste limitée cohérente avec la liste complète : les N premiers éléments
 * de `complets` (HTML à la racine) remplacent les éléments actuels.
 */
export function synchroniserListeLimitee(html: string, cheminPage: string, nom: string, complets: string[]): string {
  const $ = charger(html)
  const dossier = path.posix.dirname(cheminPage)
  listesNommees($, nom).each((_, l) => {
    const $l = $(l) as Cheerio<Element>
    const lim = parseInt($l.attr('data-bf-limite') || '', 10)
    if (!Number.isFinite(lim)) return
    const actuels = elementsDe($, $l)
    const ancre = actuels.first()
    const nouveaux = complets.slice(0, lim).map((h) => {
      const $n = $(h) as Cheerio<Element>
      reecrireUrls($, $n, '.', dossier)
      return $.html($n)
    }).join('\n')
    if (ancre.length) { ancre.before(nouveaux); actuels.remove() } else $l.append(nouveaux)
  })
  return $.html()
}

export interface NouvelElement {
  titre: string
  date?: string
  texte?: string
  photos: string[]
  page: string
}

const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre']
export function dateFr(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  if (!m) return iso
  return `${parseInt(m[3] || '0', 10)} ${MOIS[parseInt(m[2] || '1', 10) - 1]} ${m[1]}`
}

/** Ajoute un élément en tête de chaque liste « nom » de la page, en copiant le premier élément existant. */
export function ajouterEnTete(html: string, cheminPage: string, nom: string, n: NouvelElement): { html: string; touches: number } {
  const $ = charger(html)
  const dossier = path.posix.dirname(cheminPage)
  let touches = 0
  listesNommees($, nom).each((_, l) => {
    const $l = $(l) as Cheerio<Element>
    const premier = elementsDe($, $l).first()
    if (!premier.length) return
    const $n = $($.html(premier)) as Cheerio<Element>
    remplirElement($, $n, n, dossier)
    premier.before($n)
    touches++
    const lim = parseInt($l.attr('data-bf-limite') || '', 10)
    if (Number.isFinite(lim)) elementsDe($, $l).slice(lim).remove()
  })
  return { html: $.html(), touches }
}

function remplirElement($: CheerioAPI, $e: Cheerio<Element>, n: NouvelElement, dossier: string) {
  champsDirects($, $e, true).each((_, c) => {
    const $c = $(c) as Cheerio<Element>
    const cle = $c.attr('data-bf')
    if (cle === 'titre') ecrireChamp($, $c, n.titre, dossier)
    else if (cle === 'date') { ecrireChamp($, $c, n.date ? dateFr(n.date) : '', dossier); if (n.date) $c.attr('datetime', n.date) }
    else if (cle === 'photo' && n.photos[0]) ecrireChamp($, $c, n.photos[0], dossier)
    else if (cle === 'resume' || cle === 'texte') ecrireChamp($, $c, (n.texte || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 160), dossier)
  })
  const lien = $e.find('a[href]').first()
  if (lien.length) lien.attr('href', depuisRacine(n.page, dossier))
}

/** Crée le HTML d'une nouvelle page à partir d'une page modèle (data-bf-page). */
export function pageDepuisModele(modeleHtml: string, n: NouvelElement): string {
  const $ = charger(modeleHtml)
  const dossier = path.posix.dirname(n.page)
  const $t = $('title')
  if ($t.length) $t.text($t.text().replace(/^[^|]*/, `${n.titre} `))
  $('meta[name="description"]').attr('content', `${n.titre}`)
  const $page = $('[data-bf-page]').first()
  const $titre = $page.find('[data-bf="titre"]').first() as Cheerio<Element>
  if ($titre.length) ecrireChamp($, $titre, n.titre, dossier)
  const $date = $page.find('[data-bf="date"]').first() as Cheerio<Element>
  if ($date.length) {
    if (n.date) { $date.text(dateFr(n.date)); $date.attr('datetime', n.date) } else $date.text('')
  }
  const $texte = $page.find('[data-bf="texte"]').first()
  if ($texte.length) $texte.html(nettoyerRiche(n.texte || ''))
  $page.find('[data-bf-liste="photos"]').each((_, l) => {
    const $l = $(l) as Cheerio<Element>
    const els = elementsDe($, $l)
    const gabarit = els.first()
    if (!gabarit.length) return
    const photos = n.photos.length ? n.photos : []
    const html = photos.map((p) => {
      const $f = $($.html(gabarit)) as Cheerio<Element>
      $f.find('img').attr('src', depuisRacine(p, dossier))
      return $.html($f)
    }).join('')
    els.remove()
    $l.append(html)
  })
  // liens « plus récente / plus ancienne » du modèle : sans objet pour une page neuve
  $page.find('.actions').empty()
  return $.html()
}

export function slugifier(s: string): string {
  return s.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'page'
}

// ---------- comparaison (pour résumer les modifications au client) ----------

export interface ChampModifie { cle: string; type: TypeChamp; avant: string; apres: string }
export interface ListeModifiee { nom: string; complete: boolean; avant: number; apres: number }

/** Champs et listes qui diffèrent entre deux versions d'une même page. */
export function comparer(avant: AnalysePage, apres: AnalysePage): { champs: ChampModifie[]; listes: ListeModifiee[] } {
  const champs: ChampModifie[] = []
  const anciens = new Map(avant.champs.map((c) => [c.cle, c]))
  for (const c of apres.champs) {
    const a = anciens.get(c.cle)
    if (a && a.valeur !== c.valeur) champs.push({ cle: c.cle, type: c.type, avant: a.valeur, apres: c.valeur })
  }
  const listes: ListeModifiee[] = []
  const anciennes = new Map(avant.listes.map((l) => [l.nom, l]))
  for (const l of apres.listes) {
    const a = anciennes.get(l.nom)
    if (a && JSON.stringify(a.elements) !== JSON.stringify(l.elements)) {
      listes.push({ nom: l.nom, complete: l.limite === null, avant: a.elements.length, apres: l.elements.length })
    }
  }
  return { champs, listes }
}
