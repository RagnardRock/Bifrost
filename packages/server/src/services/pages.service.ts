/**
 * Mode dev : pages d'un site (créer, renommer, supprimer) et sites vidés pour servir de modèle.
 * Fonctions pures (HTML en entrée, HTML en sortie), comme flags.service et mode-dev.service.
 * Les chemins de page sont écrits depuis la racine du site (« services/plomberie.html »).
 *
 * Les pages existantes sont retouchées sur place (retouche.ts) : seul ce qui change est réécrit,
 * la mise en forme du fichier reste celle du dev.
 */
import type { Element } from 'domhandler'
import path from 'path'
import { charger, versRacine, depuisRacine, slugifier } from './flags.service'
import { Retouche } from './retouche'
import { Errors } from '../utils/errors'

/** Chemin de page accepté : minuscules, chiffres, tirets, sous-dossiers, se termine par .html. */
export const PAGE_VALIDE = /^([a-z0-9][a-z0-9-]{0,59}\/){0,3}[a-z0-9][a-z0-9-]{0,59}\.html$/

export function verifierChemin(chemin: string): string {
  const c = chemin.trim().toLowerCase()
  if (!PAGE_VALIDE.test(c)) throw Errors.badRequest('Nom de page : lettres minuscules, chiffres et tirets, terminé par .html')
  return c
}

/** Chemin proposé pour un titre : « Nos tarifs » → nos-tarifs.html */
export const cheminPour = (titre: string, dossier = '') => path.posix.join(dossier, `${slugifier(titre)}.html`)

const dossierDe = (page: string) => path.posix.dirname(page)
const echapperTexte = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/** Cible d'un lien (depuis la racine du site), sans ancre ni paramètres. null pour un lien externe. */
function cibleLien(href: string, dossierPage: string): { cible: string; suite: string } | null {
  if (!href || /^([a-z]+:|\/\/|#|\/)/i.test(href)) return null
  const i = href.search(/[?#]/)
  const base = i < 0 ? href : href.slice(0, i)
  if (!base) return null
  return { cible: versRacine(base, dossierPage), suite: i < 0 ? '' : href.slice(i) }
}

/** Réécrit les src/href d'une page qui change de dossier (sauf dans les éléments exclus). */
function deplacerUrls(r: Retouche, de: string, vers: string, exclus: Element[] = []) {
  if (de === vers) return
  const { $ } = r
  $('[src],[href]').each((_, n) => {
    if (!r.aUnLieu(n) || exclus.some((x) => x === n || $.contains(x, n))) return
    for (const a of ['src', 'href']) {
      const v = $(n).attr(a)
      if (!v) continue
      const nv = depuisRacine(versRacine(v, de), vers)
      if (nv !== v) r.attr(n, a, nv)
    }
  })
}

/** Liste du menu principal : la première <nav> qui contient une liste de liens. */
function listeMenu(r: Retouche): Element | null {
  const { $ } = r
  const $nav = $('header nav, nav').filter((_, n) => $(n).find('ul > li > a[href]').length > 0).first()
  if (!$nav.length) return null
  const ul = $nav.find('ul').filter((_, u) => $(u).children('li').children('a[href]').length > 0).first()[0]
  return ul && r.aUnLieu(ul) ? ul : null
}

/**
 * Nouvelle page à partir d'une page du site : en-tête, menu, pied de page et feuilles de style gardés,
 * contenu de <main> remplacé par un titre et un texte.
 */
export function nouvellePage(sourceHtml: string, source: string, page: string, titre: string): string {
  const r = new Retouche(sourceHtml)
  const { $ } = r
  const t = titre.trim()
  const cle = slugifier(path.posix.basename(page, '.html')).replace(/-/g, '_')
  const main = $('main').first()[0]
  const section = `<section class="bfb"><div class="bfb-conteneur">\n<h1 data-bf="${cle}.titre">${echapperTexte(t)}</h1>\n<p data-bf="${cle}.texte" data-bf-type="riche">Texte de la page.</p>\n</div></section>`
  if (!main || !r.aUnLieu(main) || !r.lieu(main).endTag) {
    // page sans <main> écrit : on repart de la version reconstruite par cheerio (rare)
    return nouvellePageSansMain(sourceHtml, source, page, t, section)
  }
  deplacerUrls(r, dossierDe(source), dossierDe(page), [main])
  const title = $('title').first()[0]
  if (title && r.aUnLieu(title)) {
    const ancien = $(title).text()
    const sep = /\s[|–—-]\s/.exec(ancien)
    r.contenu(title, echapperTexte(sep ? `${t}${ancien.slice(sep.index)}` : t))
  }
  const desc = $('meta[name="description"]').first()[0]
  if (desc && r.aUnLieu(desc)) r.attr(desc, 'content', t)
  $('[aria-current="page"]').each((_, el) => { if (r.aUnLieu(el) && !$.contains(main, el)) r.attr(el, 'aria-current', null) })
  $('[data-bf-page]').each((_, el) => { if (r.aUnLieu(el) && el !== main && !$.contains(main, el)) r.attr(el, 'data-bf-page', null) })
  if ($(main).is('[data-bf-page]')) r.attr(main, 'data-bf-page', null)
  $('nav a[href]').each((_, a) => {
    if (r.aUnLieu(a) && cibleLien($(a).attr('href') || '', dossierDe(source))?.cible === page) r.attr(a, 'aria-current', 'page')
  })
  const indent = r.indentation(main)
  r.contenu(main, `\n${indent}  ${section.replace(/\n/g, `\n${indent}  `)}\n${indent}`)
  return r.resultat()
}

function nouvellePageSansMain(sourceHtml: string, source: string, page: string, t: string, section: string): string {
  const $ = charger(sourceHtml)
  const de = dossierDe(source), vers = dossierDe(page)
  if (de !== vers) {
    $('[src],[href]').each((_, n) => {
      for (const a of ['src', 'href']) { const v = $(n).attr(a); if (v) $(n).attr(a, depuisRacine(versRacine(v, de), vers)) }
    })
  }
  const $t = $('title')
  if ($t.length) { const ancien = $t.text(); const sep = /\s[|–—-]\s/.exec(ancien); $t.text(sep ? `${t}${ancien.slice(sep.index)}` : t) }
  $('meta[name="description"]').attr('content', t)
  $('[data-bf-page]').removeAttr('data-bf-page')
  $('[aria-current="page"]').removeAttr('aria-current')
  const $body = $('body').first()
  $body.children().not('header, nav, footer, script, noscript, [hidden]').remove()
  const $entete = $body.children('header, nav').last()
  if ($entete.length) $entete.after(`<main>\n${section}\n</main>`)
  else $body.prepend(`<main>\n${section}\n</main>`)
  return $.html()
}

/** Ajoute la page au menu (copie du dernier lien du menu, pour garder ses classes). null : pas de menu ou déjà présente. */
export function ajouterAuMenu(html: string, cheminPage: string, page: string, titre: string): string | null {
  const r = new Retouche(html)
  const { $ } = r
  const ul = listeMenu(r)
  if (!ul) return null
  const dossier = dossierDe(cheminPage)
  const deja = $(ul).find('a[href]').filter((_, a) => cibleLien($(a).attr('href') || '', dossier)?.cible === page)
  if (deja.length) return null
  const dernier = $(ul).children('li').last()[0]
  if (!dernier || !r.aUnLieu(dernier)) return null
  // copie du dernier élément du menu, prise dans le texte d'origine (même écriture que le reste du menu)
  const l = r.lieu(dernier)
  const copie = new Retouche(html.slice(l.startOffset, l.endOffset))
  const li = copie.$('li').first()[0] as Element
  copie.$(li).children('ul').each((_, u) => { if (copie.aUnLieu(u)) copie.supprimer(u) })
  const a = copie.$(li).find('a').first()[0]
  if (!a) return null
  copie.attr(a, 'href', depuisRacine(page, dossier))
  copie.contenu(a, echapperTexte(titre.trim()))
  if (copie.$(a).attr('aria-current')) copie.attr(a, 'aria-current', null)
  const cle = copie.$(a).attr('data-bf')
  if (cle?.includes('.')) copie.attr(a, 'data-bf', `${cle.split('.')[0]}.${slugifier(path.posix.basename(page, '.html')).replace(/-/g, '_')}`)
  else if (cle !== undefined) copie.attr(a, 'data-bf', null)
  if (cheminPage === page) copie.attr(a, 'aria-current', 'page')
  for (const c of ['actif', 'active']) {
    const cls = copie.$(li).attr('class')
    if (cls && cls.split(/\s+/).includes(c)) copie.attr(li, 'class', cls.split(/\s+/).filter((x) => x !== c).join(' ') || null)
  }
  r.apres(dernier, copie.resultat())
  return r.resultat()
}

/** Retire la page du menu et compte les autres liens qui y mènent encore. */
export function retirerDuMenu(html: string, cheminPage: string, page: string): { html: string; retires: number; autres: number } {
  const r = new Retouche(html)
  const { $ } = r
  const dossier = dossierDe(cheminPage)
  const vers = (a: Element) => cibleLien($(a).attr('href') || '', dossier)?.cible === page
  let retires = 0
  const ul = listeMenu(r)
  const dansMenu = new Set<Element>()
  if (ul) {
    $(ul).find('li').filter((_, li) => $(li).children('a').toArray().some(vers)).each((_, li) => {
      if (!r.aUnLieu(li) || [...dansMenu].some((x) => $.contains(x, li))) return
      dansMenu.add(li)
      r.supprimer(li)
      retires++
    })
  }
  const autres = $('a[href]').toArray().filter((a) => vers(a) && ![...dansMenu].some((x) => $.contains(x, a))).length
  return { html: retires ? r.resultat() : html, retires, autres }
}

/** Liens vers une page renommée : suivent le nouveau nom (ancres et paramètres gardés). */
export function suivreRenommage(html: string, cheminPage: string, ancien: string, nouveau: string): { html: string; touches: number } {
  const r = new Retouche(html)
  const { $ } = r
  const dossier = dossierDe(cheminPage)
  let touches = 0
  $('a[href]').each((_, a) => {
    const c = cibleLien($(a).attr('href') || '', dossier)
    if (c?.cible !== ancien || !r.aUnLieu(a)) return
    r.attr(a, 'href', depuisRacine(nouveau, dossier) + c.suite)
    touches++
  })
  return { html: touches ? r.resultat() : html, touches }
}

/** Page déplacée vers un autre chemin : ses propres liens et images sont réécrits. */
export function deplacerPage(html: string, ancien: string, nouveau: string): string {
  if (dossierDe(ancien) === dossierDe(nouveau)) return html
  const r = new Retouche(html)
  deplacerUrls(r, dossierDe(ancien), dossierDe(nouveau))
  return r.resultat()
}

/**
 * Site vidé pour servir de modèle : chaque liste garde son premier élément.
 * Renvoie aussi les pages liées depuis les éléments retirés : l'appelant supprime celles qui sont
 * des pages de collection (data-bf-page, comme une actualité), pas les pages principales.
 */
export function viderListes(html: string, cheminPage: string): { html: string; pagesRetirees: string[] } {
  const r = new Retouche(html)
  const { $ } = r
  const dossier = dossierDe(cheminPage)
  const pagesRetirees: string[] = []
  const retires: Element[] = []
  $('[data-bf-liste]').each((_, l) => {
    if (retires.some((x) => $.contains(x, l))) return
    const els = $(l).find('[data-bf-element]').filter((__, e) => $(e).closest('[data-bf-liste]')[0] === l).toArray()
    for (const e of els.slice(1)) {
      if (!r.aUnLieu(e)) continue
      $(e).find('a[href]').each((___, a) => {
        const c = cibleLien($(a).attr('href') || '', dossier)
        if (c?.cible.endsWith('.html')) pagesRetirees.push(c.cible)
      })
      r.supprimer(e)
      retires.push(e)
    }
  })
  return { html: retires.length ? r.resultat() : html, pagesRetirees }
}

/** Pages du site vers lesquelles une page a un lien. */
export function liensDe(html: string, cheminPage: string): string[] {
  const $ = charger(html)
  const res = new Set<string>()
  $('a[href]').each((_, a) => { const c = cibleLien($(a).attr('href') || '', dossierDe(cheminPage)); if (c?.cible.endsWith('.html')) res.add(c.cible) })
  return [...res]
}
