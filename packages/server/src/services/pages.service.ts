/**
 * Mode dev : pages d'un site (créer, renommer, supprimer) et sites vidés pour servir de modèle.
 * Fonctions pures (HTML en entrée, HTML en sortie), comme flags.service et mode-dev.service.
 * Les chemins de page sont écrits depuis la racine du site (« services/plomberie.html »).
 */
import type { CheerioAPI, Cheerio } from 'cheerio'
import type { Element } from 'domhandler'
import path from 'path'
import { charger, versRacine, depuisRacine, slugifier } from './flags.service'
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

/** Cible d'un lien (depuis la racine du site), sans ancre ni paramètres. null pour un lien externe. */
function cibleLien(href: string, dossierPage: string): { cible: string; suite: string } | null {
  if (!href || /^([a-z]+:|\/\/|#|\/)/i.test(href)) return null
  const i = href.search(/[?#]/)
  const base = i < 0 ? href : href.slice(0, i)
  if (!base) return null
  return { cible: versRacine(base, dossierPage), suite: i < 0 ? '' : href.slice(i) }
}

/** Réécrit tous les src/href d'une page qui change de dossier. */
function deplacerUrls($: CheerioAPI, de: string, vers: string) {
  if (de === vers) return
  $('[src],[href]').each((_, n) => {
    for (const a of ['src', 'href']) {
      const v = $(n).attr(a)
      if (v) $(n).attr(a, depuisRacine(versRacine(v, de), vers))
    }
  })
}

/** Liste du menu principal : la première <nav> qui contient une liste de liens. */
function listeMenu($: CheerioAPI): Cheerio<Element> | null {
  const $nav = $('header nav, nav').filter((_, n) => $(n).find('ul > li > a[href]').length > 0).first()
  if (!$nav.length) return null
  return $nav.find('ul').filter((_, u) => $(u).children('li').children('a[href]').length > 0).first() as Cheerio<Element>
}

/**
 * Nouvelle page à partir d'une page du site : en-tête, menu, pied de page et feuilles de style gardés,
 * contenu de <main> remplacé par un titre.
 */
export function nouvellePage(sourceHtml: string, source: string, page: string, titre: string): string {
  const $ = charger(sourceHtml)
  deplacerUrls($, dossierDe(source), dossierDe(page))
  const t = titre.trim()
  const $t = $('title')
  if ($t.length) {
    const ancien = $t.text()
    const sep = /\s[|–—-]\s/.exec(ancien)
    $t.text(sep ? `${t}${ancien.slice(sep.index)}` : t)
  }
  $('meta[name="description"]').attr('content', t)
  $('[data-bf-page]').removeAttr('data-bf-page')
  // la page courante dans le menu n'est plus la source
  $('[aria-current="page"]').removeAttr('aria-current')
  const cle = slugifier(path.posix.basename(page, '.html')).replace(/-/g, '_')
  const section = `\n<section class="bfb"><div class="bfb-conteneur">\n<h1 data-bf="${cle}.titre">${$('<i>').text(t).html()}</h1>\n<p data-bf="${cle}.texte" data-bf-type="riche">Texte de la page.</p>\n</div></section>\n`
  const $main = $('main').first()
  if ($main.length) $main.html(section)
  else {
    const $body = $('body').first()
    $body.children().not('header, nav, footer, script, noscript, [hidden]').remove()
    const $entete = $body.children('header, nav').last()
    if ($entete.length) $entete.after(`<main>${section}</main>`)
    else $body.prepend(`<main>${section}</main>`)
  }
  $('nav a[href]').filter((_, a) => cibleLien($(a).attr('href') || '', dossierDe(page))?.cible === page).attr('aria-current', 'page')
  return $.html()
}

/** Ajoute la page au menu (copie du dernier lien du menu, pour garder ses classes). null : pas de menu ou déjà présente. */
export function ajouterAuMenu(html: string, cheminPage: string, page: string, titre: string): string | null {
  const $ = charger(html)
  const $ul = listeMenu($)
  if (!$ul) return null
  const dossier = dossierDe(cheminPage)
  const deja = $ul.find('a[href]').filter((_, a) => cibleLien($(a).attr('href') || '', dossier)?.cible === page)
  if (deja.length) return null
  const $dernier = $ul.children('li').last()
  const $li = $($.html($dernier)) as Cheerio<Element>
  $li.children('ul').remove()
  const $a = $li.find('a').first()
  $a.attr('href', depuisRacine(page, dossier)).text(titre.trim()).removeAttr('aria-current')
  const cle = $a.attr('data-bf')
  if (cle?.includes('.')) $a.attr('data-bf', `${cle.split('.')[0]}.${slugifier(path.posix.basename(page, '.html')).replace(/-/g, '_')}`)
  else $a.removeAttr('data-bf')
  if (cheminPage === page) $a.attr('aria-current', 'page')
  $li.find('.actif, .active').removeClass('actif active')
  $dernier.after($li)
  return $.html()
}

/** Retire la page du menu et compte les autres liens qui y mènent encore. */
export function retirerDuMenu(html: string, cheminPage: string, page: string): { html: string; retires: number; autres: number } {
  const $ = charger(html)
  const dossier = dossierDe(cheminPage)
  const vers = (a: Element) => cibleLien($(a).attr('href') || '', dossier)?.cible === page
  let retires = 0
  const $ul = listeMenu($)
  if ($ul) {
    $ul.find('li').filter((_, li) => $(li).children('a').toArray().some(vers)).each((_, li) => { $(li).remove(); retires++ })
  }
  const autres = $('a[href]').toArray().filter(vers).length
  return { html: retires ? $.html() : html, retires, autres }
}

/** Liens vers une page renommée : suivent le nouveau nom (ancres et paramètres gardés). */
export function suivreRenommage(html: string, cheminPage: string, ancien: string, nouveau: string): { html: string; touches: number } {
  const $ = charger(html)
  const dossier = dossierDe(cheminPage)
  let touches = 0
  $('a[href]').each((_, a) => {
    const c = cibleLien($(a).attr('href') || '', dossier)
    if (c?.cible !== ancien) return
    $(a).attr('href', depuisRacine(nouveau, dossier) + c.suite)
    touches++
  })
  return { html: touches ? $.html() : html, touches }
}

/** Page déplacée vers un autre chemin : ses propres liens et images sont réécrits. */
export function deplacerPage(html: string, ancien: string, nouveau: string): string {
  if (dossierDe(ancien) === dossierDe(nouveau)) return html
  const $ = charger(html)
  deplacerUrls($, dossierDe(ancien), dossierDe(nouveau))
  return $.html()
}

/**
 * Site vidé pour servir de modèle : chaque liste garde son premier élément.
 * Renvoie aussi les pages liées depuis les éléments retirés : l'appelant supprime celles qui sont
 * des pages de collection (data-bf-page, comme une actualité), pas les pages principales.
 */
export function viderListes(html: string, cheminPage: string): { html: string; pagesRetirees: string[] } {
  const $ = charger(html)
  const dossier = dossierDe(cheminPage)
  const pagesRetirees: string[] = []
  let touche = false
  $('[data-bf-liste]').each((_, l) => {
    const $els = $(l).find('[data-bf-element]').filter((__, e) => $(e).closest('[data-bf-liste]')[0] === l)
    $els.slice(1).each((__, e) => {
      $(e).find('a[href]').each((___, a) => {
        const c = cibleLien($(a).attr('href') || '', dossier)
        if (c?.cible.endsWith('.html')) pagesRetirees.push(c.cible)
      })
      $(e).remove()
      touche = true
    })
  })
  return { html: touche ? $.html() : html, pagesRetirees }
}

/** Pages du site vers lesquelles une page a un lien. */
export function liensDe(html: string, cheminPage: string): string[] {
  const $ = charger(html)
  const res = new Set<string>()
  $('a[href]').each((_, a) => { const c = cibleLien($(a).attr('href') || '', dossierDe(cheminPage)); if (c?.cible.endsWith('.html')) res.add(c.cible) })
  return [...res]
}
