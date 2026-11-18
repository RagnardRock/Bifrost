import { describe, it, expect } from 'vitest'
import { lireFormulaires, brancherFormulaires, lireEnvoi, PIEGE } from './formulaires.html'

const PAGE = `<!doctype html><html><body>
<form data-bf-formulaire="contact" data-bf-merci="merci.html">
  <label>Votre nom * <input name="nom" required></label>
  <label for="m">E-mail</label><input id="m" type="email" name="email" required>
  <textarea name="message" placeholder="Votre message" required></textarea>
  <label><input type="checkbox" name="sujets" value="a"> A</label>
  <input type="hidden" name="cache" value="x">
  <button type="submit">Envoyer</button>
</form>
<form><input name="recherche"></form>
</body></html>`

describe('formulaires', () => {
  it('lit les formulaires marqués et leurs champs', () => {
    const [f, ...autres] = lireFormulaires(PAGE)
    expect(autres).toHaveLength(0)
    expect(f!.nom).toBe('contact')
    expect(f!.merci).toBe('merci.html')
    expect(f!.champs.map((c) => [c.nom, c.libelle, c.requis, c.email])).toEqual([
      ['nom', 'Votre nom', true, false],
      ['email', 'E-mail', true, true],
      ['message', 'Votre message', true, false],
      ['sujets', 'A', false, false],
    ])
  })

  it('branche le formulaire sur Bifrost une seule fois', () => {
    const html = brancherFormulaires(PAGE, (n) => `https://bf.test/api/formulaires/s1/${n}`)!
    expect(html).toContain('action="https://bf.test/api/formulaires/s1/contact"')
    expect(html).toContain('method="post"')
    expect(html.split(`name="${PIEGE}"`)).toHaveLength(2)
    expect(lireFormulaires(html)[0]!.champs.map((c) => c.nom)).not.toContain(PIEGE)
    expect(brancherFormulaires(html, (n) => `https://bf.test/api/formulaires/s1/${n}`)).toBeNull()
    expect(brancherFormulaires('<p>rien</p>', () => '')).toBeNull()
  })

  it('ne garde que les champs du formulaire et vérifie les champs obligatoires', () => {
    const f = lireFormulaires(PAGE)[0]!
    const ok = lireEnvoi(f, { nom: ' Léa ', email: 'lea@exemple.fr', message: 'Bonjour\r\nà tous', sujets: ['a', 'b'], intrus: 'x' })
    expect(ok.robot).toBe(false)
    expect(ok.manquants).toEqual([])
    expect(ok.email).toBe('lea@exemple.fr')
    expect(ok.champs).toEqual([
      { nom: 'nom', libelle: 'Votre nom', valeur: 'Léa' },
      { nom: 'email', libelle: 'E-mail', valeur: 'lea@exemple.fr' },
      { nom: 'message', libelle: 'Votre message', valeur: 'Bonjour\nà tous' },
      { nom: 'sujets', libelle: 'A', valeur: 'a, b' },
    ])
    const ko = lireEnvoi(f, { nom: 'Léa', email: 'pas-une-adresse' })
    expect(ko.manquants).toEqual(['Votre message', 'E-mail (adresse invalide)'])
    expect(lireEnvoi(f, { [PIEGE]: 'http://spam' }).robot).toBe(true)
  })
})
