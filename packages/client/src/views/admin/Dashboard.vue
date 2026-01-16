<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useAuthStore } from '@/stores/auth.store'
import { useSitesStore } from '@/stores/sites.store'
import { statsService, type DashboardStats } from '@/services/stats.service'

const auth = useAuthStore()
const sites = useSitesStore()

const stats = ref<DashboardStats | null>(null)
const loading = ref(true)
const error = ref<string | null>(null)

const webhookSuccessRate = computed(() => {
  if (!stats.value || stats.value.activity.webhooksSent === 0) return 0
  return Math.round((stats.value.activity.webhooksSuccess / stats.value.activity.webhooksSent) * 100)
})

const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

onMounted(async () => {
  try {
    const [statsData] = await Promise.all([
      statsService.getDashboardStats(),
      sites.hasSites ? Promise.resolve() : sites.fetchSites().catch(() => {}),
    ])
    stats.value = statsData
  } catch (e) {
    error.value = 'Impossible de charger les statistiques'
    console.error(e)
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div>
    <h1 class="text-3xl font-bold mb-8">Dashboard</h1>

    <!-- Loading state -->
    <div v-if="loading" class="flex justify-center py-12">
      <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
    </div>

    <!-- Error state -->
    <div v-else-if="error" class="glass-card p-6 text-center text-red-500">
      {{ error }}
    </div>

    <template v-else-if="stats">
      <!-- Main stats cards -->
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div class="glass-card p-6">
          <h3 class="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Sites</h3>
          <p class="text-3xl font-bold">{{ stats.sites.total }}</p>
          <div class="mt-2 text-sm text-gray-500 dark:text-gray-400">
            <span class="text-green-500">{{ stats.sites.withSchema }}</span> avec schéma
          </div>
        </div>

        <div class="glass-card p-6">
          <h3 class="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Utilisateurs</h3>
          <p class="text-3xl font-bold">{{ stats.users.total }}</p>
          <div class="mt-2 text-sm text-gray-500 dark:text-gray-400">
            {{ stats.users.admins }} admins, {{ stats.users.clients }} clients
          </div>
        </div>

        <div class="glass-card p-6">
          <h3 class="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Contenu</h3>
          <p class="text-3xl font-bold">{{ stats.content.totalFields + stats.content.totalCollectionItems }}</p>
          <div class="mt-2 text-sm text-gray-500 dark:text-gray-400">
            {{ stats.content.totalFields }} champs, {{ stats.content.totalCollectionItems }} items
          </div>
        </div>

        <div class="glass-card p-6">
          <h3 class="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Modifications (7j)</h3>
          <p class="text-3xl font-bold">{{ stats.activity.recentChanges }}</p>
          <div class="mt-2 text-sm text-gray-500 dark:text-gray-400">
            derniers 7 jours
          </div>
        </div>
      </div>

      <!-- Activity & Webhooks -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <!-- Webhook stats -->
        <div class="glass-card p-6">
          <h2 class="text-xl font-semibold mb-4">Webhooks (7 derniers jours)</h2>
          <div class="grid grid-cols-3 gap-4">
            <div class="text-center">
              <p class="text-2xl font-bold">{{ stats.activity.webhooksSent }}</p>
              <p class="text-sm text-gray-500 dark:text-gray-400">Envoyés</p>
            </div>
            <div class="text-center">
              <p class="text-2xl font-bold text-green-500">{{ stats.activity.webhooksSuccess }}</p>
              <p class="text-sm text-gray-500 dark:text-gray-400">Réussis</p>
            </div>
            <div class="text-center">
              <p class="text-2xl font-bold text-red-500">{{ stats.activity.webhooksFailed }}</p>
              <p class="text-sm text-gray-500 dark:text-gray-400">Échoués</p>
            </div>
          </div>
          <div class="mt-4">
            <div class="flex justify-between text-sm mb-1">
              <span>Taux de succès</span>
              <span>{{ webhookSuccessRate }}%</span>
            </div>
            <div class="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div
                class="h-2 rounded-full transition-all"
                :class="webhookSuccessRate >= 90 ? 'bg-green-500' : webhookSuccessRate >= 70 ? 'bg-yellow-500' : 'bg-red-500'"
                :style="{ width: `${webhookSuccessRate}%` }"
              ></div>
            </div>
          </div>
        </div>

        <!-- Sites with webhooks -->
        <div class="glass-card p-6">
          <h2 class="text-xl font-semibold mb-4">Configuration des sites</h2>
          <div class="space-y-4">
            <div>
              <div class="flex justify-between text-sm mb-1">
                <span>Sites avec schéma</span>
                <span>{{ stats.sites.withSchema }} / {{ stats.sites.total }}</span>
              </div>
              <div class="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div
                  class="bg-primary-500 h-2 rounded-full transition-all"
                  :style="{ width: `${stats.sites.total ? (stats.sites.withSchema / stats.sites.total) * 100 : 0}%` }"
                ></div>
              </div>
            </div>
            <div>
              <div class="flex justify-between text-sm mb-1">
                <span>Sites avec webhook</span>
                <span>{{ stats.sites.withWebhook }} / {{ stats.sites.total }}</span>
              </div>
              <div class="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div
                  class="bg-blue-500 h-2 rounded-full transition-all"
                  :style="{ width: `${stats.sites.total ? (stats.sites.withWebhook / stats.sites.total) * 100 : 0}%` }"
                ></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Recent sites -->
      <div class="glass-card p-6 mb-8">
        <h2 class="text-xl font-semibold mb-4">Sites récents</h2>
        <div v-if="stats.recentSites.length === 0" class="text-center text-gray-500 dark:text-gray-400 py-4">
          Aucun site créé
        </div>
        <div v-else class="overflow-x-auto">
          <table class="w-full">
            <thead>
              <tr class="text-left text-sm text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                <th class="pb-3 font-medium">Nom</th>
                <th class="pb-3 font-medium">URL</th>
                <th class="pb-3 font-medium">Utilisateurs</th>
                <th class="pb-3 font-medium">Créé le</th>
                <th class="pb-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="site in stats.recentSites"
                :key="site.id"
                class="border-b border-gray-100 dark:border-gray-800 last:border-0"
              >
                <td class="py-3 font-medium">{{ site.name }}</td>
                <td class="py-3 text-gray-500 dark:text-gray-400">
                  <a :href="site.url" target="_blank" class="hover:text-primary-500">
                    {{ site.url }}
                  </a>
                </td>
                <td class="py-3">{{ site.usersCount }}</td>
                <td class="py-3 text-gray-500 dark:text-gray-400">{{ formatDate(site.createdAt) }}</td>
                <td class="py-3 text-right">
                  <router-link
                    :to="`/admin/sites/${site.id}`"
                    class="text-primary-500 hover:text-primary-600"
                  >
                    Gérer
                  </router-link>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Welcome message -->
      <div class="glass-card p-6">
        <h2 class="text-xl font-semibold mb-4">
          Bienvenue, {{ auth.admin?.email }}
        </h2>
        <p class="text-gray-600 dark:text-gray-300 mb-4">
          Vous êtes connecté en tant qu'administrateur Bifrost.
        </p>
        <div class="flex gap-4">
          <router-link to="/admin/sites" class="btn-primary">
            Gérer les sites
          </router-link>
          <router-link to="/admin/sites/new" class="btn-secondary">
            Créer un site
          </router-link>
        </div>
      </div>
    </template>
  </div>
</template>
