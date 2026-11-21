/**
 * Mode dev : le développeur touche à n'importe quel élément d'une page (pas seulement aux zones flaggées).
 *
 * Un élément est désigné par son chemin depuis <body> : l'indice de chaque élément parmi les enfants
 * de son parent, avec la balise attendue à chaque étape. Si une balise ne correspond pas, la page a changé
 * entre-temps et on refuse plutôt que de modifier le mauvais élément.
 *
 * Fonctions pures (HTML en entrée, HTML en sortie), comme flags.service.
 */
import type { CheerioAPI, Cheerio } from 'cheerio'
import type { Element } from 'domhandler'
import path from 'path'
import { charger, versRacine, depuisRacine } from './flags.service'
import { Errors } from '../utils/errors'

export interface Cible { chemin: number[]; balises: string[] }

/** Attributs de flag que le dev peut poser ou retirer. */
export interface Flags {
  'data-bf'?: string | null
  'data-bf-type'?: 'texte' | 'riche' | 'image' | 'lien' | null
  'data-bf-liste'?: string | null
  'data-bf-element'?: boolean
  'data-bf-limite'?: number | null
  'data-bf-page'?: string | null
}

export type Position = 'avant' | 'apres' | 'dedans'

export type OperationDev =
  | { op: 'flags'; flags: Flags }
  | { op: 'deplacer-vers'; vers: Cible; position: Position }
  | { op: 'texte'; valeur: string }
  | { op: 'attribut'; nom: 'alt' | 'href' | 'title'; valeur: string | null }
  | { op: 'supprimer' }
  | { op: 'dupliquer' }
  | { op: 'deplacer'; sens: 'haut' | 'bas' }

const NOM = /^[\w][\w.-]{0,99}$/

/** Chemin d'un élément depuis <body> (inverse de trouver). */
export function cheminDe(_$: CheerioAPI, $el: Cheerio<Element>): number[] {
  const chemin: number[] = []
  let x = $el
  while (x.length && !x.is('body')) {
    const p = x.parent()
    chemin.unshift(p.children().index(x))
    x = p as Cheerio<Element>
  }
  return chemin
}

function placer($el: Cheerio<Element>, html: string | Cheerio<Element>, position: Position) {
  if (position === 'avant') $el.before(html)
  else if (position === 'apres') $el.after(html)
  else $el.append(html)
}

export function trouver($: CheerioAPI, c: Cible): Cheerio<Element> {
  if (!c.chemin.length || c.chemin.length !== c.balises.length) throw Errors.badRequest('Élément introuvable')
  let $el = $('body').first() as Cheerio<Element>
  if (!$el.length) throw Errors.badRequest('Page sans <body>')
  c.chemin.forEach((i, n) => {
    const $e = $el.children().eq(i) as Cheerio<Element>
    if (!$e.length || ($e.prop('tagName') || '').toLowerCase() !== c.balises[n]) {
      throw Errors.conflict('La page a changé entre-temps : rechargez-la et resélectionnez l’élément.')
    }
    $el = $e
  })
  return $el
}

function ecrireFlags($el: Cheerio<Element>, f: Flags) {
  const texte = (nom: keyof Flags, v: string | null | undefined, controle = true) => {
    if (v === undefined) return
    if (v === null || v === '') { $el.removeAttr(nom); return }
    if (controle && !NOM.test(v)) throw Errors.badRequest(`Nom invalide pour ${nom} : lettres, chiffres, points, tirets`)
    $el.attr(nom, v)
  }
  texte('data-bf', f['data-bf'])
  if (f['data-bf-type'] !== undefined) {
    const t = f['data-bf-type']
    if (t && !['texte', 'riche', 'image', 'lien'].includes(t)) throw Errors.badRequest('Type de champ inconnu')
    texte('data-bf-type', t, false)
  }
  texte('data-bf-liste', f['data-bf-liste'])
  texte('data-bf-page', f['data-bf-page'])
  if (f['data-bf-element'] !== undefined) {
    if (f['data-bf-element']) $el.attr('data-bf-element', '')
    else $el.removeAttr('data-bf-element')
  }
  if (f['data-bf-limite'] !== undefined) {
    const l = f['data-bf-limite']
    if (l === null) $el.removeAttr('data-bf-limite')
    else if (Number.isInteger(l) && l > 0 && l < 1000) $el.attr('data-bf-limite', String(l))
    else throw Errors.badRequest('La limite doit être un nombre entier positif')
  }
  // un type sans clé n'a pas de sens : on le retire avec la clé
  if (!$el.attr('data-bf')) $el.removeAttr('data-bf-type')
}

/** Applique une opération du mode dev. Renvoie le HTML et le chemin de l'élément à sélectionner ensuite (null : aucun). */
export function operation(html: string, cible: Cible, o: OperationDev): { html: string; chemin: number[] | null } {
  const $ = charger(html)
  const $el = trouver($, cible)
  let chemin: number[] | null = cible.chemin
  const dernier = cible.chemin[cible.chemin.length - 1] as number
  const parent = cible.chemin.slice(0, -1)
  switch (o.op) {
    case 'deplacer-vers': {
      const $vers = trouver($, o.vers)
      if ($vers[0] === $el[0] || $.contains($el[0] as Element, $vers[0] as Element)) throw Errors.badRequest('Impossible de déplacer un élément dans lui-même')
      if (o.position === 'dedans' && $vers.is('img, input, br, hr')) throw Errors.badRequest('Cet élément ne peut rien contenir')
      $el.remove()
      placer($vers, $el, o.position)
      chemin = cheminDe($, $el)
      break
    }
    case 'flags':
      ecrireFlags($el, o.flags)
      break
    case 'texte':
      if ($el.children().length) throw Errors.badRequest('Cet élément contient d’autres éléments : modifiez-les un par un.')
      $el.text(o.valeur.replace(/\s+/g, ' ').trim())
      break
    case 'attribut': {
      const v = o.valeur?.trim() ?? null
      if (o.nom === 'href' && v && /^\s*(javascript|data|vbscript):/i.test(v)) throw Errors.badRequest('Adresse de lien refusée')
      if (o.nom === 'alt' && $el.is('img')) $el.attr('alt', v ?? '') // une image garde toujours son alt (vide = décorative)
      else if (v === null) $el.removeAttr(o.nom)
      else $el.attr(o.nom, v)
      break
    }
    case 'supprimer':
      if ($el.is('body > *') && $('body').children().length <= 1) throw Errors.badRequest('Impossible de vider la page')
      $el.remove()
      chemin = null
      break
    case 'dupliquer':
      $el.after($.html($el))
      chemin = [...parent, dernier + 1]
      break
    case 'deplacer': {
      if (o.sens === 'haut') {
        const $p = $el.prev()
        if (!$p.length) break
        $p.before($el)
        chemin = [...parent, dernier - 1]
      } else {
        const $s = $el.next()
        if (!$s.length || $s.is('script')) break
        $s.after($el)
        chemin = [...parent, dernier + 1]
      }
      break
    }
  }
  return { html: $.html(), chemin }
}

// ---------- sections toutes faites (blocs) ----------

/** Premier segment des clés hors liste et noms de listes : « galerie » pour galerie.titre et data-bf-liste="galerie". */
export function prefixes(html: string): Set<string> {
  const res = new Set<string>()
  for (const m of html.matchAll(/data-bf(?:-liste)?="([^"]+)"/g)) res.add((m[1] as string).split('.')[0] as string)
  return res
}

/**
 * Donne aux clés d'un bloc des noms libres dans le site : galerie.titre → galerie-2.titre si « galerie » est déjà pris.
 * Les clés propres aux éléments de liste (titre, photo) ne changent pas.
 */
export function renommerBloc(blocHtml: string, pris: Set<string>): string {
  const $ = charger(`<body>${blocHtml}</body>`)
  const libre = new Map<string, string>()
  const nouveau = (p: string) => {
    if (!pris.has(p)) return p
    if (!libre.has(p)) {
      let n = 2
      while (pris.has(`${p}-${n}`)) n++
      libre.set(p, `${p}-${n}`)
      pris.add(`${p}-${n}`)
    }
    return libre.get(p) as string
  }
  $('[data-bf-liste]').each((_, el) => { const v = $(el).attr('data-bf-liste') as string; $(el).attr('data-bf-liste', nouveau(v)) })
  $('[data-bf]').each((_, el) => {
    if ($(el).parents('[data-bf-element]').length || $(el).is('[data-bf-element]')) return
    const v = $(el).attr('data-bf') as string
    const [p, ...reste] = v.split('.')
    $(el).attr('data-bf', [nouveau(p as string), ...reste].join('.'))
  })
  return $('body').html() || ''
}

/** Insère le HTML d'un bloc (chemins depuis la racine du site) avant, après ou dans l'élément ciblé. */
export function inserer(html: string, cheminPage: string, cible: Cible | null, blocHtml: string, position: Position): { html: string; chemin: number[] } {
  const $ = charger(html)
  const $cible = cible ? trouver($, cible) : ($('main').first().length ? $('main').first() : $('body').first()) as Cheerio<Element>
  const $bloc = $(`<div>${blocHtml}</div>`).children().first() as Cheerio<Element>
  if (!$bloc.length) throw Errors.badRequest('Bloc vide')
  const dossier = path.posix.dirname(cheminPage)
  $bloc.find('[src],[href]').add($bloc.filter('[src],[href]')).each((_, n) => {
    for (const a of ['src', 'href']) { const v = $(n).attr(a); if (v) $(n).attr(a, depuisRacine(v, dossier)) }
  })
  placer($cible, $bloc, cible ? position : 'dedans')
  return { html: $.html(), chemin: cheminDe($, $bloc) }
}

/** Ajoute la feuille de style des blocs dans <head> si elle n'y est pas. */
export function lierFeuilleBlocs(html: string, cheminPage: string, fichier = 'assets/bifrost-blocs.css'): string {
  if (html.includes('bifrost-blocs.css')) return html
  const $ = charger(html)
  const lien = `<link rel="stylesheet" href="${depuisRacine(fichier, path.posix.dirname(cheminPage))}">`
  if ($('head').length) $('head').append(lien + '\n')
  else return lien + html
  return $.html()
}

/** HTML d'un élément, avec ses chemins ramenés à la racine du site (pour l'enregistrer comme bloc). */
export function extraire(html: string, cheminPage: string, cible: Cible): string {
  const $ = charger(html)
  const $el = trouver($, cible)
  const $c = $($.html($el)) as Cheerio<Element>
  const dossier = path.posix.dirname(cheminPage)
  $c.find('[src],[href]').add($c.filter('[src],[href]')).each((_, n) => {
    for (const a of ['src', 'href']) { const v = $(n).attr(a); if (v) $(n).attr(a, versRacine(v, dossier)) }
  })
  $c.find('.bf-dev-choisi, .bf-dev-survol, .bf-dev-flag').removeClass('bf-dev-choisi bf-dev-survol bf-dev-flag')
  return $.html($c)
}
