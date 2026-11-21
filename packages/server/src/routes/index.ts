import { Router } from 'express'
import authRoutes from './auth.routes'
import editeurRoutes from './editeur.routes'
import comptesRoutes from './comptes.routes'
import suiviRoutes from './suivi.routes'
import clientsRoutes from './clients.routes'
import reseauxRoutes from './reseaux.routes'

const router = Router()

// Connexion du dev (admin) et session courante
router.use('/auth', authRoutes)

// Comptes clients : connexion par e-mail, invitations, mot de passe oublié
router.use('/comptes', comptesRoutes)

// Réseaux sociaux : retour d'Instagram après l'autorisation
router.use('/reseaux', reseauxRoutes)

// Éditeur sur place : dev et clients du site
router.use('/editeur/:siteId', editeurRoutes)

// Espace développeur : suivi des sites
router.use('/admin/suivi', suiviRoutes)

// Espace développeur : fiches clients et contrats
router.use('/admin/clients', clientsRoutes)

export default router
