<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useSitesStore } from '@/stores/sites.store'
import { useToastStore } from '@/stores/toast.store'
import Modal from '@/components/ui/Modal.vue'

const sites = useSitesStore()
const toast = useToastStore()

// Modal state
const showCreateModal = ref(false)
const isSubmitting = ref(false)

// Form state
const formName = ref('')
const formUrl = ref('')
const formWebhookUrl = ref('')
const formErrors = ref<Record<string, string>>({})

// Load sites on mount
onMounted(async () => {
  try {
    await sites.fetchSites()
  } catch {
    toast.error('Impossible de charger les sites')
  }
})

// Form validation
function validateForm(): boolean {
  formErrors.value = {}

  if (!formName.value.trim()) {
    formErrors.value.name = 'Le nom est requis'
  }

  if (!formUrl.value.trim()) {
    formErrors.value.url = "L'URL est requise"
  } else {
    try {
      new URL(formUrl.value)
    } catch {
      formErrors.value.url = 'URL invalide'
    }
  }

  if (formWebhookUrl.value.trim()) {
    try {
      new URL(formWebhookUrl.value)
    } catch {
      formErrors.value.webhookUrl = 'URL de webhook invalide'
    }
  }

  return Object.keys(formErrors.value).length === 0
}

// Create site
async function handleCreate() {
  if (!validateForm()) return

  isSubmitting.value = true
  try {
    await sites.createSite({
      name: formName.value.trim(),
      url: formUrl.value.trim(),
      webhookUrl: formWebhookUrl.value.trim() || undefined,
    })
    toast.success('Site créé avec succès')
    closeModal()
  } catch {
    toast.error(sites.error || 'Erreur lors de la création du site')
  } finally {
    isSubmitting.value = false
  }
}

// Reset form
function resetForm() {
  formName.value = ''
  formUrl.value = ''
  formWebhookUrl.value = ''
  formErrors.value = {}
}

function openCreateModal() {
  resetForm()
  showCreateModal.value = true
}

function closeModal() {
  showCreateModal.value = false
  resetForm()
}

// Copy API key to clipboard
async function copyApiKey(apiKey: string) {
  try {
    await navigator.clipboard.writeText(apiKey)
    toast.success('Clé API copiée')
  } catch {
    toast.error('Impossible de copier la clé')
  }
}

// Format date
function formatDate(date: Date | string): string {
  return new Date(date).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}
</script>

<template>
  <div>
    <div class="flex justify-between items-center mb-8">
      <h1 class="text-3xl font-bold">Sites</h1>
      <button class="btn-primary" @click="openCreateModal">+ Nouveau site</button>
    </div>

    <!-- Loading state -->
    <div v-if="sites.isLoading && !sites.hasSites" class="glass-card p-12 text-center">
      <p class="text-gray-500 dark:text-gray-400">Chargement...</p>
    </div>

    <!-- Empty state -->
    <div v-else-if="!sites.hasSites" class="glass-card p-12 text-center">
      <p class="text-gray-500 dark:text-gray-400 mb-4">Aucun site pour le moment.</p>
      <p class="text-sm text-gray-400 dark:text-gray-500">
        Créez votre premier site pour commencer à gérer du contenu.
      </p>
    </div>

    <!-- Sites list -->
    <div v-else class="space-y-4">
      <div
        v-for="site in sites.sites"
        :key="site.id"
        class="glass-card p-6 hover:bg-white/5 transition-colors"
      >
        <div class="flex items-start justify-between gap-4">
          <div class="flex-1 min-w-0">
            <h3 class="text-lg font-semibold truncate">{{ site.name }}</h3>
            <a
              :href="site.url"
              target="_blank"
              rel="noopener"
              class="text-sm text-blue-500 hover:underline truncate block"
            >
              {{ site.url }}
            </a>
            <p class="text-xs text-gray-500 dark:text-gray-400 mt-2">
              Créé le {{ formatDate(site.createdAt) }}
            </p>
          </div>

          <div class="flex items-center gap-2">
            <!-- API Key display -->
            <div class="hidden sm:flex items-center gap-2 bg-black/20 rounded-lg px-3 py-1.5">
              <code class="text-xs text-gray-400 font-mono">
                {{ site.apiKey.slice(0, 15) }}...
              </code>
              <button
                @click="copyApiKey(site.apiKey)"
                class="text-blue-500 hover:text-blue-400 text-sm"
                title="Copier la clé API"
              >
                📋
              </button>
            </div>

            <!-- Actions -->
            <a
              :href="`${site.url}?edit=true`"
              target="_blank"
              rel="noopener"
              class="glass-button px-3 py-2 text-sm"
              title="Éditer sur le site"
            >
              Éditer
            </a>
            <router-link
              :to="`/admin/sites/${site.id}`"
              class="glass-button px-4 py-2 text-sm"
            >
              Gérer
            </router-link>
          </div>
        </div>
      </div>
    </div>

    <!-- Create Modal -->
    <Modal :open="showCreateModal" title="Nouveau site" @close="closeModal">
      <form @submit.prevent="handleCreate" class="space-y-4">
        <!-- Name -->
        <div>
          <label for="site-name" class="block text-sm font-medium mb-1">
            Nom du site <span class="text-red-500">*</span>
          </label>
          <input
            id="site-name"
            v-model="formName"
            type="text"
            class="input-field"
            placeholder="Mon super site"
            :class="{ 'border-red-500': formErrors.name }"
          />
          <p v-if="formErrors.name" class="text-red-500 text-xs mt-1">
            {{ formErrors.name }}
          </p>
        </div>

        <!-- URL -->
        <div>
          <label for="site-url" class="block text-sm font-medium mb-1">
            URL <span class="text-red-500">*</span>
          </label>
          <input
            id="site-url"
            v-model="formUrl"
            type="url"
            class="input-field"
            placeholder="https://monsite.com"
            :class="{ 'border-red-500': formErrors.url }"
          />
          <p v-if="formErrors.url" class="text-red-500 text-xs mt-1">
            {{ formErrors.url }}
          </p>
        </div>

        <!-- Webhook URL -->
        <div>
          <label for="site-webhook" class="block text-sm font-medium mb-1">
            URL Webhook <span class="text-gray-400 text-xs">(optionnel)</span>
          </label>
          <input
            id="site-webhook"
            v-model="formWebhookUrl"
            type="url"
            class="input-field"
            placeholder="https://monsite.com/api/webhook"
            :class="{ 'border-red-500': formErrors.webhookUrl }"
          />
          <p v-if="formErrors.webhookUrl" class="text-red-500 text-xs mt-1">
            {{ formErrors.webhookUrl }}
          </p>
          <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Recevez une notification à chaque modification de contenu.
          </p>
        </div>
      </form>

      <template #footer>
        <button type="button" class="glass-button px-4 py-2" @click="closeModal">
          Annuler
        </button>
        <button
          type="submit"
          class="btn-primary px-4 py-2"
          :disabled="isSubmitting"
          @click="handleCreate"
        >
          {{ isSubmitting ? 'Création...' : 'Créer le site' }}
        </button>
      </template>
    </Modal>
  </div>
</template>
