import { describe, it, expect, vi } from 'vitest'

vi.mock('../config/database', () => ({ prisma: {} }))
const { versElement } = await import('./reseaux.service')

describe('post Instagram → actualité', () => {
  it('titre = première ligne sans mots-clés, texte en paragraphes échappés, lien vers le post', () => {
    const e = versElement({
      id: '1', media_type: 'IMAGE', media_url: 'https://cdn.test/a.jpg', permalink: 'https://www.instagram.com/p/abc/',
      timestamp: '2026-11-20T18:30:00+0000',
      caption: 'Sortie circuit de Nogaro ! #vroom #circuit\nMerci à tous\n\nProchaine date : <bientôt> & plus\n\n#asso #pilotes',
    })
    expect(e.titre).toBe('Sortie circuit de Nogaro !')
    expect(e.date).toBe('2026-11-20')
    // la première ligne est devenue le titre ; la ligne de mots-clés seule disparaît ; le lien est à part (pas dans le résumé)
    expect(e.texte).toBe('<p>Merci à tous</p>\n<p>Prochaine date : &lt;bientôt&gt; &amp; plus</p>')
    expect(e.source).toEqual({ url: 'https://www.instagram.com/p/abc/', libelle: 'Voir sur Instagram' })
    expect(e.images).toEqual(['https://cdn.test/a.jpg'])
  })

  it('sans légende : titre daté ; titre long coupé sur un mot', () => {
    expect(versElement({ id: '2', media_type: 'IMAGE', media_url: 'https://cdn.test/b.jpg', timestamp: '2026-03-05T10:00:00+0000' }).titre).toBe('Publication du 05/03/2026')
    const long = versElement({ id: '3', media_type: 'IMAGE', timestamp: '2026-03-05T10:00:00+0000', caption: 'Un très long titre '.repeat(8) })
    expect(long.titre.length).toBeLessThanOrEqual(81)
    expect(long.titre).toMatch(/ (Un|très|long|titre)…$/)
    expect(long.texte).toContain('Un très long titre Un très long titre') // la ligne coupée reste entière dans le texte
  })

  it('carrousel : toutes les images (aperçu pour une vidéo), 10 au plus, https seulement', () => {
    const e = versElement({
      id: '4', media_type: 'CAROUSEL_ALBUM', timestamp: '2026-03-05T10:00:00+0000',
      children: { data: [
        { media_type: 'IMAGE', media_url: 'https://cdn.test/1.jpg' },
        { media_type: 'VIDEO', media_url: 'https://cdn.test/v.mp4', thumbnail_url: 'https://cdn.test/v.jpg' },
        { media_type: 'IMAGE', media_url: 'http://pas-sur.test/x.jpg' },
        ...Array.from({ length: 12 }, (_, i) => ({ media_type: 'IMAGE', media_url: `https://cdn.test/n${i}.jpg` })),
      ] },
    })
    expect(e.images.slice(0, 2)).toEqual(['https://cdn.test/1.jpg', 'https://cdn.test/v.jpg'])
    expect(e.images).toHaveLength(10)
    expect(e.images.some((u) => u.startsWith('http:'))).toBe(false)
  })
})
