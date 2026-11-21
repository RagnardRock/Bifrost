/**
 * Thème d'un site (mode dev) : les variables CSS déclarées dans « :root { … } » des feuilles du site,
 * plus celles des sections Bifrost (--bf-…), rangées dans assets/bf-theme.css.
 * Les fonctions sur le texte CSS sont pures et testées à part.
 */

export interface Variable { nom: string; valeur: string }

/** Variables des sections Bifrost, avec leur valeur par défaut (celle de bifrost-blocs.css). */
export const VARIABLES_BIFROST: (Variable & { libelle: string })[] = [
  { nom: '--bf-accent', valeur: '#2f5d50', libelle: 'Boutons des sections' },
  { nom: '--bf-sur-accent', valeur: '#ffffff', libelle: 'Texte des boutons' },
  { nom: '--bf-fond-doux', valeur: 'rgba(0, 0, 0, .04)', libelle: 'Fond des cartes' },
  { nom: '--bf-trait', valeur: 'rgba(0, 0, 0, .12)', libelle: 'Traits et bordures' },
  { nom: '--bf-rayon', valeur: '14px', libelle: 'Arrondi des photos et cartes' },
  { nom: '--bf-largeur', valeur: '1100px', libelle: 'Largeur du contenu' },
  { nom: '--bf-largeur-texte', valeur: '720px', libelle: 'Largeur des textes' },
  { nom: '--bf-espace-section', valeur: 'clamp(48px, 8vw, 96px)', libelle: 'Espace autour des sections' },
]

export const FICHIER_THEME = 'assets/bf-theme.css'

const NOM = /^--[a-zA-Z0-9_-]{1,60}$/

/** Une valeur sûre : pas de quoi fermer la déclaration ou sortir du CSS. */
export function valeurValide(v: string): boolean {
  return v.trim().length > 0 && v.length <= 300 && !/[;{}<>]|\/\*|\*\//.test(v)
}

/** Les blocs « :root { … } » de premier niveau (hors @media), avec leur position dans le texte. */
function blocsRoot(css: string): { debut: number; fin: number }[] {
  const res: { debut: number; fin: number }[] = []
  const sansCommentaires = css.replace(/\/\*[\s\S]*?\*\//g, (m) => ' '.repeat(m.length))
  let profondeur = 0
  let selecteurDebut = 0
  for (let i = 0; i < sansCommentaires.length; i++) {
    const c = sansCommentaires[i]
    if (c === '{') {
      if (profondeur === 0) {
        const selecteur = sansCommentaires.slice(selecteurDebut, i).trim()
        if (/^:root$/.test(selecteur)) {
          let j = i + 1
          let p = 1
          while (j < sansCommentaires.length && p > 0) { if (sansCommentaires[j] === '{') p++; else if (sansCommentaires[j] === '}') p--; j++ }
          res.push({ debut: i + 1, fin: j - 1 })
        }
      }
      profondeur++
    } else if (c === '}') {
      profondeur = Math.max(0, profondeur - 1)
      if (profondeur === 0) selecteurDebut = i + 1
    } else if (c === ';' && profondeur === 0) selecteurDebut = i + 1
  }
  return res
}

export function lireVariables(css: string): Variable[] {
  const res: Variable[] = []
  for (const b of blocsRoot(css)) {
    const corps = css.slice(b.debut, b.fin).replace(/\/\*[\s\S]*?\*\//g, '')
    for (const m of corps.matchAll(/(--[a-zA-Z0-9_-]+)\s*:\s*([^;]+?)\s*(?:;|$)/g)) {
      const nom = m[1] as string
      const i = res.findIndex((v) => v.nom === nom)
      const v = { nom, valeur: (m[2] as string).trim() }
      if (i >= 0) res[i] = v; else res.push(v)
    }
  }
  return res
}

/** Remplace la valeur d'une variable dans le dernier « :root » qui la déclare ; l'ajoute au premier « :root » (ou en crée un) sinon. */
export function ecrireVariable(css: string, nom: string, valeur: string): string {
  if (!NOM.test(nom)) throw new Error(`Nom de variable invalide : ${nom}`)
  if (!valeurValide(valeur)) throw new Error(`Valeur refusée pour ${nom}`)
  const blocs = blocsRoot(css)
  const echappe = nom.replace(/[-]/g, '\\-')
  for (const b of [...blocs].reverse()) {
    const corps = css.slice(b.debut, b.fin)
    const re = new RegExp(`(${echappe}\\s*:\\s*)([^;]+?)(\\s*)(;|$)`)
    if (re.test(corps)) return css.slice(0, b.debut) + corps.replace(re, (_t, a, _v, esp, fin) => `${a}${valeur.trim()}${esp}${fin}`) + css.slice(b.fin)
  }
  if (blocs.length) {
    const b = blocs[0] as { debut: number; fin: number }
    const corps = css.slice(b.debut, b.fin)
    const indent = /\n([ \t]+)--/.exec(corps)?.[1] ?? '  '
    const avant = corps.replace(/\s*$/, '')
    const sep = avant.trim() && !avant.trim().endsWith(';') ? ';' : ''
    return css.slice(0, b.debut) + `${avant}${sep}\n${indent}${nom}: ${valeur.trim()};\n` + css.slice(b.fin)
  }
  return `:root {\n  ${nom}: ${valeur.trim()};\n}\n${css}`
}
