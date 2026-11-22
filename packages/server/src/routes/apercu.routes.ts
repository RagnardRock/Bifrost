/**
 * /apercu/<siteId>/…  le brouillon du site, avec le script d'édition injecté (cookie d'aperçu requis)
 * /sites/<siteId>/…   la version publiée
 * monasso.fr/…        la version publiée, sur le domaine propre du client (relayé par Caddy)
 */
import { Router, type Request, type Response, type NextFunction } from 'express'
import express from 'express'
import fs from 'fs/promises'
import path from 'path'
import jwt from 'jsonwebtoken'
import { config } from '../config'
import { dossiers, cheminSur, fichierPause } from '../services/site-fichiers.service'
import { siteParCle } from '../services/slug.service'
import { siteParDomaine } from '../services/domaines.service'

export const apercuRouter = Router()

apercuRouter.get(['/apercu/:siteId', '/apercu/:siteId/*'], async (req, res) => {
  const siteId = String(req.params.siteId)
  try {
    const p = jwt.verify(req.cookies?.bf_apercu || '', config.jwtSecret) as { siteId?: string }
    if (p.siteId !== siteId) throw new Error()
  } catch {
    return res.status(401).send('Session d’édition expirée : rouvrez l’éditeur.')
  }
  let page = (req.params as Record<string, string>)[0] || 'index.html'
  if (page.endsWith('/')) page += 'index.html'
  let fichier: string
  try { fichier = cheminSur(dossiers(siteId).brouillon, page) } catch { return res.status(400).end() }
  res.set('Cache-Control', 'no-store')
  if (!page.endsWith('.html')) return res.sendFile(fichier, (e) => { if (e && !res.headersSent) res.status(404).end() })
  try {
    const html = await fs.readFile(fichier, 'utf-8')
    const script = `<script src="/editeur/overlay.js" data-page="${page.replace(/"/g, '')}"></script>`
    res.type('html').send(html.includes('</body>') ? html.replace('</body>', `${script}\n</body>`) : html + script)
  } catch {
    res.status(404).send('Page introuvable')
  }
})

/** La version en ligne d'un site (ou sa page de pause). */
export async function servirPublie(id: string, req: Request, res: Response, next: NextFunction) {
  let racine: string
  try { racine = dossiers(id).publie } catch { return res.status(400).end() }
  // Site en pause : sa page de pause, pour toutes les adresses
  const pause = await fs.readFile(fichierPause(id), 'utf-8').catch(() => null)
  if (pause !== null) return res.status(503).set('Retry-After', '86400').type('html').send(pause)
  express.static(path.resolve(racine), {
    extensions: ['html'],
    // Une publication change les pages : le HTML est toujours redemandé, le reste gardé 7 jours
    setHeaders: (r, f) => r.setHeader('Cache-Control', /\.html?$/i.test(f) ? 'no-cache' : 'public, max-age=604800'),
  })(req, res, next)
}

// /sites/<nom court ou identifiant>/…
apercuRouter.use('/sites/:cle', async (req, res, next) => {
  const id = await siteParCle(req.params.cle).catch(() => null)
  if (!id) return res.status(404).send('Site introuvable')
  return servirPublie(id, req, res, next)
})

/**
 * Domaine propre d'un client (monasso.fr), relayé par Caddy : tout le domaine est le site,
 * sauf /api/ (formulaires du site). Une page absente donne la 404 du site s'il en a une.
 */
export async function parDomaine(req: Request, res: Response, next: NextFunction) {
  if (req.path.startsWith('/api/')) return next()
  try {
    const id = await siteParDomaine(req.hostname)
    if (!id) return next()
    await servirPublie(id, req, res, async () => {
      const p404 = await fs.readFile(path.join(dossiers(id).publie, '404.html'), 'utf-8').catch(() => null)
      res.status(404).type('html').send(p404 ?? 'Page introuvable')
    })
  } catch (e) { next(e) }
}
