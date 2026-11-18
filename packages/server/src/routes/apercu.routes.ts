/**
 * /apercu/<siteId>/…  le brouillon du site, avec le script d'édition injecté (cookie d'aperçu requis)
 * /sites/<siteId>/…   la version publiée (pour essayer en local ; en production, servie par le serveur web)
 */
import { Router } from 'express'
import express from 'express'
import fs from 'fs/promises'
import path from 'path'
import jwt from 'jsonwebtoken'
import { config } from '../config'
import { dossiers, cheminSur } from '../services/site-fichiers.service'

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

apercuRouter.use('/sites/:siteId', (req, res, next) => {
  let racine: string
  try { racine = dossiers(req.params.siteId).publie } catch { return res.status(400).end() }
  express.static(path.resolve(racine))(req, res, next)
})
