/**
 * Formulaires des sites (data-bf-formulaire) : lecture et préparation du HTML.
 * Fonctions pures (HTML en entrée, HTML ou description en sortie), testées à part.
 *
 * <form data-bf-formulaire="contact" data-bf-merci="merci.html">
 *   <label>Nom <input name="nom" required></label>
 *   <label>E-mail <input type="email" name="email" required></label>
 *   <label>Message <textarea name="message" required></textarea></label>
 *   <button>Envoyer</button>
 * </form>
 */
import * as cheerio from 'cheerio'

/** Champ piège : invisible pour un humain, rempli par les robots. */
export const PIEGE = 'bf_site_web'

export interface ChampFormulaire {
  nom: string
  libelle: string
  requis: boolean
  email: boolean
}

export interface Formulaire {
  nom: string
  merci: string | null
  champs: ChampFormulaire[]
}

const NOM_VALIDE = /^[a-z0-9][a-z0-9_-]{0,39}$/i

/** Nom de formulaire accepté dans une adresse. */
export const nomValide = (nom: string) => NOM_VALIDE.test(nom)

const propre = (t: string) => t.replace(/\s+/g, ' ').replace(/\s*[:*]\s*$/, '').trim()

/** Les formulaires d'une page, avec leurs champs. */
export function lireFormulaires(html: string): Formulaire[] {
  if (!html.includes('data-bf-formulaire')) return []
  const $ = cheerio.load(html)
  const res: Formulaire[] = []
  $('form[data-bf-formulaire]').each((_, f) => {
    const $f = $(f)
    const nom = String($f.attr('data-bf-formulaire') || '').trim()
    if (!nomValide(nom)) return
    const champs: ChampFormulaire[] = []
    $f.find('input[name], textarea[name], select[name]').each((__, el) => {
      const $el = $(el)
      const n = String($el.attr('name'))
      const type = String($el.attr('type') || '').toLowerCase()
      if (n === PIEGE || ['submit', 'button', 'reset', 'file', 'image', 'password', 'hidden'].includes(type)) return
      if (champs.some((c) => c.nom === n)) return // boutons radio : un seul champ
      const id = $el.attr('id')
      const $label = id ? $f.find(`label[for="${id.replace(/"/g, '')}"]`) : $f.find('#__aucun')
      const parent = $el.closest('label')
      let libelle = ''
      if ($label.length) libelle = $label.first().text()
      else if (parent.length) libelle = parent.clone().find('input, textarea, select, option').remove().end().text()
      libelle = propre(libelle) || propre(String($el.attr('aria-label') || $el.attr('placeholder') || '')) || n
      champs.push({ nom: n, libelle: libelle.slice(0, 80), requis: $el.is('[required]'), email: type === 'email' })
    })
    res.push({ nom, merci: $f.attr('data-bf-merci') || null, champs })
  })
  return res
}

/**
 * Branche les formulaires de la page sur Bifrost : adresse d'envoi, méthode POST et champ piège.
 * Renvoie null si la page n'a rien à changer (pas de formulaire, ou déjà branchée).
 */
export function brancherFormulaires(html: string, adresse: (nom: string) => string): string | null {
  if (!html.includes('data-bf-formulaire')) return null
  const $ = cheerio.load(html)
  let change = false
  $('form[data-bf-formulaire]').each((_, f) => {
    const $f = $(f)
    const nom = String($f.attr('data-bf-formulaire') || '').trim()
    if (!nomValide(nom)) return
    const action = adresse(nom)
    if ($f.attr('action') !== action) { $f.attr('action', action); change = true }
    if (($f.attr('method') || '').toLowerCase() !== 'post') { $f.attr('method', 'post'); change = true }
    if (!$f.find(`[name="${PIEGE}"]`).length) {
      $f.prepend(`<p aria-hidden="true" style="position:absolute;left:-10000px;width:1px;height:1px;overflow:hidden"><label>Ne pas remplir <input type="text" name="${PIEGE}" tabindex="-1" autocomplete="off"></label></p>`)
      change = true
    }
  })
  return change ? $.html() : null
}

/** Valeur lisible d'un champ envoyé (texte, ou liste de cases cochées). */
function valeurDe(brut: unknown): string {
  if (Array.isArray(brut)) return brut.map(valeurDe).filter(Boolean).join(', ')
  if (typeof brut === 'string' || typeof brut === 'number' || typeof brut === 'boolean') return String(brut).replace(/\r\n?/g, '\n').trim()
  return ''
}

export const LIMITE_CHAMP = 5000

export interface Envoi {
  robot: boolean
  champs: { nom: string; libelle: string; valeur: string }[]
  email: string | null
  manquants: string[]
}

/** Garde seulement les champs déclarés dans le formulaire publié, coupés à une longueur raisonnable. */
export function lireEnvoi(f: Formulaire, corps: Record<string, unknown>): Envoi {
  const robot = valeurDe(corps[PIEGE]) !== ''
  const champs = f.champs.map((c) => ({ nom: c.nom, libelle: c.libelle, valeur: valeurDe(corps[c.nom]).slice(0, LIMITE_CHAMP) }))
  const manquants = f.champs.filter((c, i) => c.requis && !champs[i]!.valeur).map((c) => c.libelle)
  const champEmail = f.champs.findIndex((c) => c.email)
  const brut = champEmail >= 0 ? champs[champEmail]!.valeur : ''
  const email = /^[^\s@<>,;]{1,64}@[^\s@<>,;]{1,190}\.[a-z]{2,}$/i.test(brut) ? brut : null
  if (champEmail >= 0 && brut && !email) manquants.push(`${f.champs[champEmail]!.libelle} (adresse invalide)`)
  return { robot, champs, email, manquants }
}
