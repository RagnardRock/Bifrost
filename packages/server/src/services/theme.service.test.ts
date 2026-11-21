import { describe, it, expect } from 'vitest'
import * as t from './theme.service'

const css = `/* couleurs */
:root {
  --vert: #284e3f;
  --largeur: 1180px;
  font-size: 112.5%;
}
@media (prefers-color-scheme: dark) { :root { --vert: #000; } }
body { color: var(--vert); }
:root { --serif: "Fraunces", Georgia, serif }
`

describe('thème', () => {
  it('lit les variables des :root de premier niveau seulement', () => {
    expect(t.lireVariables(css)).toEqual([
      { nom: '--vert', valeur: '#284e3f' },
      { nom: '--largeur', valeur: '1180px' },
      { nom: '--serif', valeur: '"Fraunces", Georgia, serif' },
    ])
  })

  it('remplace une valeur sans toucher au reste', () => {
    const r = t.ecrireVariable(css, '--vert', '#1e4034')
    expect(r).toContain('--vert: #1e4034;\n  --largeur')
    expect(r).toContain('{ :root { --vert: #000; } }')
    expect(t.ecrireVariable(css, '--serif', 'Georgia')).toContain(':root { --serif: Georgia }')
  })

  it('ajoute une variable absente au premier :root, ou crée le :root', () => {
    expect(t.ecrireVariable(css, '--bf-accent', 'var(--vert)')).toContain('font-size: 112.5%;\n  --bf-accent: var(--vert);\n}')
    expect(t.ecrireVariable('', '--bf-rayon', '8px')).toBe(':root {\n  --bf-rayon: 8px;\n}\n')
  })

  it('refuse les valeurs qui sortiraient de la déclaration', () => {
    expect(() => t.ecrireVariable(css, '--vert', 'red; } body { display:none')).toThrow()
    expect(() => t.ecrireVariable(css, '--vert', '</style>')).toThrow()
    expect(() => t.ecrireVariable(css, 'color', 'red')).toThrow()
  })
})
