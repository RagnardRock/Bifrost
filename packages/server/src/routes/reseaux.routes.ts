/** Retour d'Instagram après l'autorisation (public : le jeton signé dans « state » dit quel site). */
import { Router } from 'express'
import { config } from '../config'
import * as reseaux from '../services/reseaux.service'

const router = Router()

router.get('/instagram/retour', (req, res) => {
  const q = req.query as Record<string, string | undefined>
  reseaux.retourConnexion(q.code, q.state, q.error)
    .then((chemin) => res.redirect(`${config.appUrl}${chemin}`))
    .catch(() => res.redirect(`${config.appUrl}/?instagram=expire`))
})

export default router
