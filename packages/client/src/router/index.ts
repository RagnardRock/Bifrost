import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth.store'

export const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      redirect: '/login',
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
          path: 'activite',
          name: 'admin-activity',
          component: () => import('@/views/admin/JournalActivite.vue'),
        },
        { path: 'activity', redirect: '/admin/activite' },
      ],
    },
    // Espace « Mon site » : messages, équipe, réglages, mon compte
    {
      path: '/mon-site/:siteId',
      name: 'mon-site',
      component: () => import('@/views/MonSite.vue'),
      meta: { requiresAuth: true },
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
  if (auth.token && !auth.currentUser) {
    await auth.checkAuth()
  }

  // Admin routes protection
  if (to.meta.requiresAdmin) {
    if (!auth.isAdmin) {
      return next({ name: 'admin-login' })
    }
  }

  // Éditeur : dev ou client du site
  if (to.meta.requiresAuth && !auth.isAuthenticated) {
    return next({ name: 'login', query: { site: to.params.siteId as string } })
  }

  // Redirect authenticated admins away from admin login
  if (to.meta.adminGuest && auth.isAdmin) {
    return next({ name: 'admin-dashboard' })
  }

  // Redirect authenticated clients away from client login
  if (to.meta.clientGuest && auth.isClient) {
    const siteId = (auth.currentUser as { siteId?: string } | null)?.siteId
    if (siteId) return next({ name: 'editeur', params: { siteId } })
  }

  next()
})
