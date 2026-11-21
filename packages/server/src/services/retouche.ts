/**
 * Retouches ciblées d'un fichier HTML : on repère les éléments avec cheerio (positions dans le texte
 * d'origine, parse5), puis on ne change que les morceaux de texte concernés. Le reste du fichier garde
 * exactement sa mise en forme (doctype, guillemets, indentation, entités) : important pour le code
 * écrit à la main du dev, ouvert dans Rune et suivi par Git.
 */
import * as cheerio from 'cheerio'
import type { CheerioAPI } from 'cheerio'
import type { Element } from 'domhandler'

interface Lieu {
  startOffset: number
  endOffset: number
  startTag?: { startOffset: number; endOffset: number; attrs?: Record<string, { startOffset: number; endOffset: number }> }
  endTag?: { startOffset: number; endOffset: number }
  attrs?: Record<string, { startOffset: number; endOffset: number }>
}
interface Modif { debut: number; fin: number; texte: string; ordre: number }

const echapper = (v: string) => v.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')

export class Retouche {
  readonly $: CheerioAPI
  private modifs: Modif[] = []
  constructor(readonly source: string) {
    this.$ = cheerio.load(source, { sourceCodeLocationInfo: true } as Parameters<typeof cheerio.load>[1])
  }

  lieu(el: Element): Lieu {
    const l = (el as Element & { sourceCodeLocation?: Lieu }).sourceCodeLocation
    if (!l) throw new Error('Élément sans position dans le fichier')
    return l
  }
  /** L'élément est-il écrit dans le fichier (et pas ajouté par le navigateur, comme un <tbody> implicite) ? */
  aUnLieu(el: Element) { return !!(el as Element & { sourceCodeLocation?: Lieu }).sourceCodeLocation }

  private ajouter(debut: number, fin: number, texte: string) {
    this.modifs.push({ debut, fin, texte, ordre: this.modifs.length })
  }

  /** Pose (ou retire avec null) un attribut. Un attribut sans valeur s'écrit avec valeur === ''. */
  attr(el: Element, nom: string, valeur: string | null) {
    const l = this.lieu(el)
    const a = l.attrs?.[nom] ?? l.startTag?.attrs?.[nom]
    const texte = valeur === null ? '' : valeur === '' ? nom : `${nom}="${echapper(valeur)}"`
    if (a) {
      if (valeur === null) {
        // l'espace qui précède part avec l'attribut
        let d = a.startOffset
        while (d > 0 && /[ \t]/.test(this.source[d - 1] as string)) d--
        this.ajouter(d, a.endOffset, '')
      } else this.ajouter(a.startOffset, a.endOffset, texte)
      return
    }
    if (valeur === null) return
    const fin = (l.startTag ?? l).endOffset
    const avant = this.source[fin - 2] === '/' ? fin - 2 : fin - 1
    this.ajouter(avant, avant, ` ${texte}`)
  }

  /** Remplace le contenu d'un élément (entre sa balise ouvrante et sa balise fermante). */
  contenu(el: Element, html: string) {
    const l = this.lieu(el)
    if (!l.startTag || !l.endTag) throw new Error('Élément sans balise fermante')
    this.ajouter(l.startTag.endOffset, l.endTag.startOffset, html)
  }

  /** Retire un élément ; seul sur sa ligne, la ligne part avec lui. */
  supprimer(el: Element) {
    const l = this.lieu(el)
    let d = l.startOffset
    let f = l.endOffset
    let a = d
    while (a > 0 && /[ \t]/.test(this.source[a - 1] as string)) a--
    let b = f
    while (b < this.source.length && /[ \t]/.test(this.source[b] as string)) b++
    if ((a === 0 || this.source[a - 1] === '\n') && (b === this.source.length || this.source[b] === '\n' || this.source[b] === '\r')) {
      d = a
      f = this.source[b] === '\r' ? b + 2 : b + 1
    }
    this.ajouter(d, f, '')
  }

  /** Indentation de la ligne où commence l'élément. */
  indentation(el: Element): string {
    const d = this.lieu(el).startOffset
    const debutLigne = this.source.lastIndexOf('\n', d - 1) + 1
    const avant = this.source.slice(debutLigne, d)
    return /^[ \t]*$/.test(avant) ? avant : (/^[ \t]*/.exec(avant)?.[0] ?? '')
  }
  /** L'élément commence-t-il sa ligne ? (on insère alors un voisin sur une nouvelle ligne) */
  seulSurSaLigne(el: Element): boolean {
    const d = this.lieu(el).startOffset
    return /^[ \t]*$/.test(this.source.slice(this.source.lastIndexOf('\n', d - 1) + 1, d))
  }

  /** Insère du HTML juste après l'élément, sur une nouvelle ligne indentée comme lui si c'était le cas. */
  apres(el: Element, html: string) {
    const l = this.lieu(el)
    this.ajouter(l.endOffset, l.endOffset, this.seulSurSaLigne(el) ? `\n${this.indentation(el)}${html}` : html)
  }
  /** Insère du HTML à la fin du contenu de l'élément (avant sa balise fermante). */
  dedansALaFin(el: Element, html: string) {
    const l = this.lieu(el)
    if (!l.endTag) throw new Error('Élément sans balise fermante')
    const debutLigne = this.source.lastIndexOf('\n', l.endTag.startOffset - 1) + 1
    const avantFermante = this.source.slice(debutLigne, l.endTag.startOffset)
    if (/^[ \t]*$/.test(avantFermante)) this.ajouter(debutLigne, debutLigne, `${avantFermante}  ${html}\n`)
    else this.ajouter(l.endTag.startOffset, l.endTag.startOffset, html)
  }

  get modifie() { return this.modifs.length > 0 }

  /** Le texte avec les retouches. Deux retouches qui se chevauchent : erreur (bug de l'appelant). */
  resultat(): string {
    const m = [...this.modifs].sort((a, b) => a.debut - b.debut || a.ordre - b.ordre)
    let res = ''
    let pos = 0
    for (const x of m) {
      if (x.debut < pos) throw new Error('Retouches qui se chevauchent')
      res += this.source.slice(pos, x.debut) + x.texte
      pos = x.fin
    }
    return res + this.source.slice(pos)
  }
}
