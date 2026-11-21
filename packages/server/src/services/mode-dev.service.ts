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
import { charger } from './flags.service'
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

export type OperationDev =
  | { op: 'flags'; flags: Flags }
  | { op: 'texte'; valeur: string }
  | { op: 'attribut'; nom: 'alt' | 'href' | 'title'; valeur: string | null }
  | { op: 'supprimer' }
  | { op: 'dupliquer' }
  | { op: 'deplacer'; sens: 'haut' | 'bas' }

const NOM = /^[\w][\w.-]{0,99}$/

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
