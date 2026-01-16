<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useSitesStore } from '@/stores/sites.store'
import { activityService, type ActivityEntry, type ActivityFilters } from '@/services/activity.service'

const sites = useSitesStore()

const activity = ref<ActivityEntry[]>([])
const loading = ref(true)
const error = ref<string | null>(null)
const total = ref(0)
const currentPage = ref(1)
const pageSize = 20

// Filters
const selectedSite = ref<string>('')
const selectedType = ref<string>('')
const startDate = ref<string>('')
const endDate = ref<string>('')

const typeOptions = [
  { value: '', label: 'Tous les types' },
  { value: 'field_update', label: 'Modification de champ' },
  { value: 'item_create', label: 'Création d\'item' },
  { value: 'item_update', label: 'Modification d\'item' },
  { value: 'item_delete', label: 'Suppression d\'item' },
]

const totalPages = computed(() => Math.ceil(total.value / pageSize))

const getTypeLabel = (type: string) => {
  const labels: Record<string, string> = {
    field_update: 'Champ modifié',
    item_create: 'Item créé',
    item_update: 'Item modifié',
    item_delete: 'Item supprimé',
  }
  return labels[type] || type
}

const getTypeClass = (type: string) => {
  const classes: Record<string, string> = {
    field_update: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
    item_create: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
    item_update: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
    item_delete: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
  }
  return classes[type] || 'bg-gray-100 text-gray-800'
}

const formatDate = (dateString: string) => {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'À l\'instant'
  if (diffMins < 60) return `Il y a ${diffMins} min`
  if (diffHours < 24) return `Il y a ${diffHours}h`
  if (diffDays < 7) return `Il y a ${diffDays}j`

  return date.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  })
}

const fetchActivity = async () => {
  loading.value = true
  error.value = null

  try {
    const filters: ActivityFilters = {}
    if (selectedSite.value) filters.siteId = selectedSite.value
    if (selectedType.value) filters.type = selectedType.value as ActivityFilters['type']
    if (startDate.value) filters.startDate = startDate.value
    if (endDate.value) filters.endDate = endDate.value

    const offset = (currentPage.value - 1) * pageSize
    const result = await activityService.getActivity(filters, pageSize, offset)

    activity.value = result.data
    total.value = result.pagination.total
  } catch (e) {
    error.value = 'Impossible de charger l\'activité'
    console.error(e)
  } finally {
    loading.value = false
  }
}

const applyFilters = () => {
  currentPage.value = 1
  fetchActivity()
}

const clearFilters = () => {
  selectedSite.value = ''
  selectedType.value = ''
  startDate.value = ''
  endDate.value = ''
  currentPage.value = 1
  fetchActivity()
}

const goToPage = (page: number) => {
  if (page >= 1 && page <= totalPages.value) {
    currentPage.value = page
    fetchActivity()
  }
}

// Watch for filter changes
watch([selectedSite, selectedType], () => {
  applyFilters()
})

onMounted(async () => {
  if (!sites.hasSites) {
    await sites.fetchSites().catch(() => {})
  }
  fetchActivity()
})
</script>

<template>
  <div>
    <h1 class="text-3xl font-bold mb-8">Activité</h1>

    <!-- Filters -->
    <div class="glass-card p-4 mb-6">
      <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
        <!-- Site filter -->
        <div>
          <label class="block text-sm font-medium mb-1">Site</label>
          <select
            v-model="selectedSite"
            class="input-field w-full"
          >
            <option value="">Tous les sites</option>
            <option
              v-for="site in sites.sites"
              :key="site.id"
              :value="site.id"
            >
              {{ site.name }}
            </option>
          </select>
        </div>

        <!-- Type filter -->
        <div>
          <label class="block text-sm font-medium mb-1">Type</label>
          <select
            v-model="selectedType"
            class="input-field w-full"
          >
            <option
              v-for="option in typeOptions"
              :key="option.value"
              :value="option.value"
            >
              {{ option.label }}
            </option>
          </select>
        </div>

        <!-- Date range -->
        <div>
          <label class="block text-sm font-medium mb-1">Date début</label>
          <input
            v-model="startDate"
            type="date"
            class="input-field w-full"
            @change="applyFilters"
          />
        </div>

        <div>
          <label class="block text-sm font-medium mb-1">Date fin</label>
          <input
            v-model="endDate"
            type="date"
            class="input-field w-full"
            @change="applyFilters"
          />
        </div>
      </div>

      <div class="flex justify-end mt-4">
        <button
          v-if="selectedSite || selectedType || startDate || endDate"
          @click="clearFilters"
          class="text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
        >
          Effacer les filtres
        </button>
      </div>
    </div>

    <!-- Loading state -->
    <div v-if="loading" class="flex justify-center py-12">
      <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
    </div>

    <!-- Error state -->
    <div v-else-if="error" class="glass-card p-6 text-center text-red-500">
      {{ error }}
    </div>

    <!-- Empty state -->
    <div v-else-if="activity.length === 0" class="glass-card p-12 text-center">
      <p class="text-gray-500 dark:text-gray-400">Aucune activité trouvée</p>
    </div>

    <!-- Activity feed -->
    <div v-else class="space-y-4">
      <div
        v-for="entry in activity"
        :key="entry.id"
        class="glass-card p-4 hover:bg-white/60 dark:hover:bg-gray-800/60 transition-colors"
      >
        <div class="flex items-start justify-between gap-4">
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2 mb-1">
              <span
                :class="getTypeClass(entry.type)"
                class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
              >
                {{ getTypeLabel(entry.type) }}
              </span>
              <router-link
                :to="`/admin/sites/${entry.siteId}`"
                class="text-sm font-medium text-primary-500 hover:text-primary-600 truncate"
              >
                {{ entry.siteName }}
              </router-link>
            </div>

            <p class="text-sm text-gray-900 dark:text-white">
              {{ entry.summary }}
            </p>

            <div class="flex items-center gap-3 mt-2 text-xs text-gray-500 dark:text-gray-400">
              <span v-if="entry.userEmail">
                par {{ entry.userEmail }}
              </span>
              <span v-else>
                par Admin
              </span>
              <span>{{ formatDate(entry.changedAt) }}</span>
            </div>
          </div>

          <router-link
            :to="`/admin/sites/${entry.siteId}`"
            class="text-sm text-primary-500 hover:text-primary-600 whitespace-nowrap"
          >
            Voir le site
          </router-link>
        </div>
      </div>

      <!-- Pagination -->
      <div v-if="totalPages > 1" class="flex items-center justify-between pt-4">
        <p class="text-sm text-gray-500 dark:text-gray-400">
          {{ total }} résultats
        </p>

        <div class="flex items-center gap-2">
          <button
            @click="goToPage(currentPage - 1)"
            :disabled="currentPage === 1"
            class="px-3 py-1 rounded border border-gray-300 dark:border-gray-600 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            Précédent
          </button>

          <span class="text-sm text-gray-600 dark:text-gray-400">
            Page {{ currentPage }} / {{ totalPages }}
          </span>

          <button
            @click="goToPage(currentPage + 1)"
            :disabled="currentPage === totalPages"
            class="px-3 py-1 rounded border border-gray-300 dark:border-gray-600 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            Suivant
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
