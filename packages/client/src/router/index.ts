import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth.store'

export const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      // Ouverture de l'appli : le dev va à son espace, le client sur le dernier site modifié
      redirect: () => {
        let role: string | null = null
        let dernier: string | null = null
        try { role = localStorage.getItem('role'); dernier = localStorage.getItem('bf-dernier-site') } catch { /* stockage indisponible */ }
        if (role === 'admin') return '/admin'
        if (role === 'client') return dernier ? `/edition/${dernier}` : '/espace'
        return '/login'
      },
    },
    {
      path: '/login',
      name: 'login',
      component: () => import('@/views/Login.vue'),
      meta: { guest: true, clientGuest: true },
    },
    {
      path: '/acces/:jeton',
      name: 'acces',
      component: () => import('@/views/Acces.vue'),
    },
    {
      path: '/admin/login',
      name: 'admin-login',
      component: () => import('@/views/AdminLogin.vue'),
      meta: { guest: true, adminGuest: true },
    },
    // Admin routes
    {
      path: '/admin',
      component: () => import('@/components/layout/AdminLayout.vue'),
      meta: { requiresAdmin: true },
      children: [
        {
          path: '',
          name: 'admin-dashboard',
          component: () => import('@/views/admin/Suivi.vue'),
        },
        { path: 'sites', redirect: '/admin' },
        {
          path: 'sites/:id',
          name: 'admin-site-detail',
          component: () => import('@/views/admin/SiteFiche.vue'),
        },
        {
          path: 'clients',
          name: 'admin-clients',
          component: () => import('@/views/admin/Clients.vue'),
        },
        {
          path: 'clients/:id',
          name: 'admin-client',
          component: () => import('@/views/admin/ClientFiche.vue'),
        },
        {
          path: 'compte',
          name: 'admin-compte',
          component: () => import('@/views/admin/MonCompteDev.vue'),
        },
        {
          path: 'activite',
          name: 'admin-activity',
          component: () => import('@/views/admin/JournalActivite.vue'),
        },
        { path: 'activity', redirect: '/admin/activite' },
      ],
    },
    // Espace client : ses sites, tous ses messages, son compte, et la gestion de chaque site
    {
      path: '/espace',
      component: () => import('@/components/layout/EspaceLayout.vue'),
      meta: { requiresAuth: true },
      children: [
        { path: '', name: 'espace', component: () => import('@/views/espace/Accueil.vue') },
        { path: 'messages', name: 'espace-messages', component: () => import('@/views/espace/Messages.vue') },
        { path: 'compte', name: 'espace-compte', component: () => import('@/views/espace/Compte.vue') },
        { path: 'sites/:siteId', name: 'mon-site', component: () => import('@/views/MonSite.vue') },
      ],
    },
    // Ancienne adresse (liens déjà envoyés, notifications) : même page dans l'espace
    {
      path: '/mon-site/:siteId',
      redirect: (to) => (to.query.onglet === 'compte' ? '/espace/compte' : { name: 'mon-site', params: to.params, query: to.query }),
    },
    // Éditeur sur place (v2) : dev et client
    {
      path: '/edition/:siteId',
      name: 'editeur',
      component: () => import('@/views/Editeur.vue'),
      meta: { requiresAuth: true },
    },
    // Catch all 404
    {
      path: '/:pathMatch(.*)*',
      name: 'not-found',
      component: () => import('@/views/NotFound.vue'),
    },
  ],
})

// Navigation guards
router.beforeEach(async (to, _from, next) => {
  const auth = useAuthStore()

  // Check auth on first load
  if (auth.role && !auth.currentUser) {
    await auth.checkAuth()
  }

  // Admin routes protection
  if (to.meta.requiresAdmin) {
    if (!auth.isAdmin) {
      return next({ name: 'admin-login' })
    }
    // Double authentification obligatoire pas encore activée : seul « Mon compte » est ouvert
    if (auth.admin?.doubleAuthAActiver && to.name !== 'admin-compte') return next({ name: 'admin-compte' })
  }

  // Éditeur et espace client : dev ou client connecté
  if (to.meta.requiresAuth && !auth.isAuthenticated) {
    return next({ name: 'login', query: to.params.siteId ? { site: to.params.siteId as string } : {} })
  }

  // Redirect authenticated admins away from admin login
  if (to.meta.adminGuest && auth.isAdmin) {
    return next({ name: 'admin-dashboard' })
  }

  // Redirect authenticated clients away from client login
  if (to.meta.clientGuest && auth.isClient) return next({ name: 'espace' })

  next()
})
