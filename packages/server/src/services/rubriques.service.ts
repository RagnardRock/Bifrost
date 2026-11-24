/**
 * Rubriques (blog, actualités, Instagram…) et fils qui en mélangent plusieurs.
 * - Une rubrique = une liste data-bf-liste="<nom>" + une page modèle <nom>/_modele.html (data-bf-page="<nom>").
 *   Chaque article a sa page, créée depuis le modèle par le bouton « + » de l'éditeur.
 * - Un fil = une liste en lecture seule (data-bf-fil="blog,instagram") recalculée à chaque changement d'une rubrique :
 *   les articles des rubriques choisies, triés par date. Ses champs ne sont pas des data-bf : le client ne les modifie pas.
 * Fonctions pures sur du HTML ; les chemins des gabarits sont écrits depuis la racine du site.
 */
import path from 'path'
import type { Cheerio, CheerioAPI } from 'cheerio'
import type { Element } from 'domhandler'
import { charger, depuisRacine, versRacine, slugifier, resumer, dateIso } from './flags.service'

export const CHAMPS_ARTICLE = ['photo', 'date', 'resume', 'texte', 'auteur', 'categorie', 'lien'] as const
export type ChampArticle = typeof CHAMPS_ARTICLE[number]

export const NOM_MODELE = '_modele.html'
export const cheminModele = (nom: string) => `${nom}/${NOM_MODELE}`

const ATTENTE = 'assets/bifrost-attente.svg'
const echapper = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** Nom technique d'une rubrique depuis son libellé (« Nos actus » → nos-actus). */
export function nomRubrique(libelle: string): string {
  return slugifier(libelle).slice(0, 40)
}

/** Carte d'un article dans la liste (chemins depuis la racine). */
export function carteArticle(champs: readonly ChampArticle[], lien = '#'): string {
  const a = (c: ChampArticle) => champs.includes(c)
  const meta = a('date') || a('categorie')
    ? `<p class="bfb-article-meta">${a('date') ? '<time data-bf="date" datetime="">Date</time>' : ''}${a('categorie') ? '<span class="bfb-badge" data-bf="categorie">Catégorie</span>' : ''}</p>`
    : ''
  return `<li class="bfb-article" data-bf-element>`
    + (a('photo') ? `<img data-bf="photo" src="${ATTENTE}" alt="">` : '')
    + `<div class="bfb-article-corps">${meta}<h3 data-bf="titre"><a href="${lien}">Titre de l’article</a></h3>`
    + (a('resume') || a('texte') ? '<p data-bf="resume">Le début de l’article.</p>' : '')
    + (a('auteur') ? '<p class="bfb-article-auteur">Par <span data-bf="auteur">Auteur</span></p>' : '')
    + `</div></li>`
}

/** Section avec la liste d'une rubrique, vide au départ (la carte attend dans data-bf-gabarit). */
export function sectionListe(nom: string, titre: string, carte: string, limite: number | null, cle: string): string {
  return `<section class="bfb bfb-rubrique">\n  <div class="bfb-conteneur">\n`
    + `    <h2 data-bf="${cle}.titre">${echapper(titre)}</h2>\n`
    + `    <ul class="bfb-articles" data-bf-liste="${nom}"${limite ? ` data-bf-limite="${limite}"` : ''} data-bf-gabarit="${echapper(carte)}"></ul>\n`
    + `    <p class="bfb-vide">Les articles apparaîtront ici.</p>\n`
    + `  </div>\n</section>`
}

/** Contenu de la page modèle d'un article (dans <main>). Chemins relatifs à la page, un dossier plus bas. */
export function sectionArticle(nom: string, libelle: string, champs: readonly ChampArticle[], retour: string | null): string {
  const a = (c: ChampArticle) => champs.includes(c)
  const meta = a('date') || a('categorie')
    ? `\n    <p class="bfb-article-meta">${a('date') ? '<time data-bf="date" datetime="">Date</time>' : ''}${a('categorie') ? '<span class="bfb-badge" data-bf="categorie">Catégorie</span>' : ''}</p>`
    : ''
  return `<article class="bfb bfb-article-page">\n  <div class="bfb-conteneur bfb-etroit" data-bf-page="${nom}" data-bf-libelle="${echapper(libelle)}">`
    + (retour ? `\n    <p class="bfb-retour"><a href="${retour}">← ${echapper(libelle)}</a></p>` : '')
    + meta
    + `\n    <h1 data-bf="titre">Titre de l’article</h1>`
    + (a('auteur') ? `\n    <p class="bfb-article-auteur">Par <span data-bf="auteur">Auteur</span></p>` : '')
    + (a('photo') ? `\n    <div class="bfb-article-photos" data-bf-liste="photos"><figure data-bf-element><img data-bf="photo" src="../${ATTENTE}" alt=""></figure></div>` : '')
    + (a('texte') ? `\n    <div data-bf="texte" data-bf-type="riche"><p>Le texte de l’article.</p></div>` : '')
    + (a('lien') ? `\n    <p class="bfb-article-lien"><a data-bf="lien" href="#" target="_blank" rel="noopener">Voir le lien</a></p>` : '')
    + `\n  </div>\n</article>`
}

/** Champs d'une rubrique, lus dans sa page modèle (pour le formulaire « + » de l'éditeur). */
export function champsDuModele(html: string): { libelle: string | null; champs: ChampArticle[] } {
  const $ = charger(html)
  const $p = $('[data-bf-page]').first()
  const cles = new Set($p.find('[data-bf]').toArray().map((e) => $(e).attr('data-bf') as string))
  const libelle = $p.attr('data-bf-libelle') || null
  // rubrique écrite à la main (avant les blocs) : photo, date et texte comme avant, plus ce que sa page montre
  const champs = CHAMPS_ARTICLE.filter((c) => c !== 'resume' && (cles.has(c) || (!libelle && ['photo', 'date', 'texte'].includes(c))))
  return { libelle, champs }
}

// ---------- fils ----------

export interface ArticleFil { rubrique: string; libelle: string; titre: string; date: string | null; photo: string | null; resume: string; lien: string | null; ordre: number }

/** Articles d'une liste de rubrique (les éléments sont écrits depuis la racine, comme elementsListe les rend). */
export function articlesDe(elements: string[], rubrique: string, libelle: string): ArticleFil[] {
  return elements.map((h, ordre) => {
    const $ = charger(`<body>${h}</body>`)
    const $e = $('body').children().first()
    const champ = (c: string) => $e.find(`[data-bf="${c}"]`).first()
    const $d = champ('date')
    const $img = $e.find('img').first()
    const href = $e.find('a[href]').first().attr('href') || null
    const texteResume = champ('resume').length ? champ('resume').text() : champ('texte').text()
    return {
      rubrique, libelle, ordre,
      titre: champ('titre').text().replace(/\s+/g, ' ').trim() || $e.find('h2, h3, h4').first().text().replace(/\s+/g, ' ').trim(),
      date: $d.length ? dateIso($d.attr('datetime'), $d.text()) : null,
      photo: $img.attr('src') || null,
      resume: resumer(texteResume),
      lien: href && href !== '#' ? href : null,
    }
  })
}

/** Mélange : du plus récent au plus ancien ; sans date, à la suite, dans l'ordre de leur rubrique. */
export function trier(articles: ArticleFil[]): ArticleFil[] {
  return [...articles].sort((a, b) => {
    if (a.date && b.date) return a.date < b.date ? 1 : a.date > b.date ? -1 : a.ordre - b.ordre
    if (a.date) return -1
    if (b.date) return 1
    return a.ordre - b.ordre
  })
}

const MOIS_FR = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre']
const dateFr = (iso: string) => { const [y, m, d] = iso.split('-'); return `${parseInt(d || '1', 10)} ${MOIS_FR[parseInt(m || '1', 10) - 1]} ${y}` }

/** Carte d'un fil (lecture seule). */
export const CARTE_FIL = '<li class="bfb-article" data-bf-fil-element><img data-bf-fil-champ="photo" src="" alt=""><div class="bfb-article-corps"><p class="bfb-article-meta"><time data-bf-fil-champ="date"></time><span class="bfb-badge" data-bf-fil-champ="rubrique"></span></p><h3><a data-bf-fil-champ="titre" href="#"></a></h3><p data-bf-fil-champ="resume"></p></div></li>'

/** Section d'un fil. */
export function sectionFil(rubriques: string[], titre: string, limite: number | null, cle: string): string {
  return `<section class="bfb bfb-fil">\n  <div class="bfb-conteneur">\n`
    + `    <h2 data-bf="${cle}.titre">${echapper(titre)}</h2>\n`
    + `    <ul class="bfb-articles" data-bf-fil="${rubriques.join(',')}"${limite ? ` data-bf-limite="${limite}"` : ''} data-bf-gabarit="${echapper(CARTE_FIL)}"></ul>\n`
    + `    <p class="bfb-vide">Les articles apparaîtront ici.</p>\n`
    + `  </div>\n</section>`
}

/** Rubriques mélangées par les fils d'une page. */
export function rubriquesDesFils(html: string): string[] {
  const $ = charger(html)
  const res = new Set<string>()
  $('[data-bf-fil]').each((_, l) => { for (const r of ($(l).attr('data-bf-fil') || '').split(',')) if (r.trim()) res.add(r.trim()) })
  return [...res]
}

/** Remplit les fils d'une page avec les articles des rubriques (chemins depuis la racine). */
export function remplirFils(html: string, cheminPage: string, articles: Map<string, ArticleFil[]>): string {
  const $ = charger(html)
  const dossier = path.posix.dirname(cheminPage)
  $('[data-bf-fil]').each((_, l) => {
    const $l = $(l) as Cheerio<Element>
    const noms = ($l.attr('data-bf-fil') || '').split(',').map((x) => x.trim()).filter(Boolean)
    const lim = parseInt($l.attr('data-bf-limite') || '', 10)
    let liste = trier(noms.flatMap((n) => articles.get(n) || []))
    if (Number.isFinite(lim) && lim > 0) liste = liste.slice(0, lim)
    const gabarit = $l.attr('data-bf-gabarit') || CARTE_FIL
    $l.children('[data-bf-fil-element]').remove()
    for (const a of liste) $l.append(carteFil($, gabarit, a, dossier, noms.length > 1))
  })
  return $.html()
}

function carteFil($: CheerioAPI, gabarit: string, a: ArticleFil, dossier: string, badge: boolean): Cheerio<Element> {
  const $c = $(gabarit) as Cheerio<Element>
  const ch = (n: string) => $c.find(`[data-bf-fil-champ="${n}"]`)
  const vers = (u: string) => depuisRacine(versRacine(u, '.'), dossier)
  if (a.photo) ch('photo').attr('src', vers(a.photo)).attr('alt', '')
  else ch('photo').remove()
  if (a.date) ch('date').attr('datetime', a.date).text(dateFr(a.date)); else ch('date').remove()
  if (badge) ch('rubrique').text(a.libelle); else ch('rubrique').remove()
  ch('titre').text(a.titre)
  if (a.lien) ch('titre').attr('href', vers(a.lien)); else ch('titre').removeAttr('href')
  if (a.resume) ch('resume').text(a.resume); else ch('resume').remove()
  return $c
}
