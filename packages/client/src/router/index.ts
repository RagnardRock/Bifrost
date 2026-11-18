import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth.store'

export const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: () => import('@/views/Home.vue'),
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
          component: () => import('@/views/admin/Dashboard.vue'),
        },
        {
          path: 'sites',
          name: 'admin-sites',
          component: () => import('@/views/admin/SitesList.vue'),
        },
        {
          path: 'sites/:id',
          name: 'admin-site-detail',
          component: () => import('@/views/admin/SiteDetail.vue'),
        },
        {
          path: 'sites/:id/content',
          name: 'admin-site-content',
          component: () => import('@/views/admin/SiteContent.vue'),
        },
        {
          path: 'activity',
          name: 'admin-activity',
          component: () => import('@/views/admin/Activity.vue'),
        },
      ],
    },
    // Client routes
    {
      path: '/dashboard',
      component: () => import('@/components/layout/ClientLayout.vue'),
      meta: { requiresClient: true },
      children: [
        {
          path: '',
          name: 'client-dashboard',
          component: () => import('@/views/client/Dashboard.vue'),
        },
        {
          path: 'content',
          name: 'client-content',
          component: () => import('@/views/client/Content.vue'),
        },
      ],
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

  // Client routes protection
  if (to.meta.requiresClient) {
    if (!auth.isClient) {
      return next({ name: 'login' })
    }
  }

  // Redirect authenticated admins away from admin login
  if (to.meta.adminGuest && auth.isAdmin) {
    return next({ name: 'admin-dashboard' })
  }

  // Redirect authenticated clients away from client login
  if (to.meta.clientGuest && auth.isClient) {
    const siteId = (auth.currentUser as { siteId?: string } | null)?.siteId
    return next(siteId ? { name: 'editeur', params: { siteId } } : { name: 'client-dashboard' })
  }

  next()
})
