<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useSitesStore } from '@/stores/sites.store'
import { useUsersStore } from '@/stores/users.store'
import { useToastStore } from '@/stores/toast.store'
import { schemaService } from '@/services/schema.service'
import { webhooksService, type WebhookLog } from '@/services/webhooks.service'
import { historyService, type HistoryEntry } from '@/services/history.service'
import Modal from '@/components/ui/Modal.vue'
import SchemaEditor from '@/components/schema/SchemaEditor.vue'
import type { User } from '@bifrost/shared'

const route = useRoute()
const router = useRouter()
const sites = useSitesStore()
const usersStore = useUsersStore()
const toast = useToastStore()

const siteId = computed(() => route.params.id as string)

// Origin URL for integration script
const originUrl = computed(() => window.location.origin)

// Schema state
const schemaYaml = ref<string | null>(null)
const isSchemaLoading = ref(false)

// Edit mode
const isEditing = ref(false)
const isSaving = ref(false)

// Form state
const formName = ref('')
const formUrl = ref('')
const formWebhookUrl = ref('')
const formErrors = ref<Record<string, string>>({})

// Delete modal
const showDeleteModal = ref(false)
const isDeleting = ref(false)

// Regenerate key modal
const showRegenerateModal = ref(false)
const isRegenerating = ref(false)

// User management
const showUserModal = ref(false)
const showDeleteUserModal = ref(false)
const editingUser = ref<User | null>(null)
const userToDelete = ref<User | null>(null)
const isUserSaving = ref(false)
const isUserDeleting = ref(false)

// User form state
const userEmail = ref('')
const userPassword = ref('')
const userFormErrors = ref<Record<string, string>>({})

// Webhook state
const webhookLogs = ref<WebhookLog[]>([])
const isWebhookLoading = ref(false)
const isSendingTest = ref(false)

// History state
const historyEntries = ref<HistoryEntry[]>([])
const isHistoryLoading = ref(false)
const isRestoring = ref(false)
const expandedHistory = ref<Set<string>>(new Set())

// Load site on mount
onMounted(async () => {
  try {
    const site = await sites.fetchSite(siteId.value)
    initForm(site)
    // Load users, schema, webhooks, and history in parallel
    await Promise.all([
      usersStore.fetchUsers(siteId.value),
      loadSchema(),
      loadWebhookLogs(),
      loadHistory(),
    ])
  } catch {
    toast.error('Site introuvable')
    router.push('/admin/sites')
  }
})

// Load schema
async function loadSchema() {
  isSchemaLoading.value = true
  try {
    const result = await schemaService.getSchema(siteId.value)
    schemaYaml.value = result.yaml
  } catch {
    // Schema not found is ok
    schemaYaml.value = null
  } finally {
    isSchemaLoading.value = false
  }
}

// Handle schema saved
function onSchemaSaved(yaml: string) {
  schemaYaml.value = yaml
  // Refresh site to update schema in store
  sites.fetchSite(siteId.value)
}

// Handle schema cleared
function onSchemaCleared() {
  schemaYaml.value = null
  sites.fetchSite(siteId.value)
}

// Load webhook logs
async function loadWebhookLogs() {
  if (!sites.currentSite?.webhookUrl) return

  isWebhookLoading.value = true
  try {
    webhookLogs.value = await webhooksService.getLogs(siteId.value, 20)
  } catch {
    // Silent fail for webhooks
  } finally {
    isWebhookLoading.value = false
  }
}

// Send test webhook
async function sendTestWebhook() {
  isSendingTest.value = true
  try {
    await webhooksService.sendTest(siteId.value)
    toast.success('Webhook de test envoye')
    // Reload logs after short delay
    setTimeout(() => loadWebhookLogs(), 1000)
  } catch {
    toast.error('Erreur lors de l\'envoi du webhook')
  } finally {
    isSendingTest.value = false
  }
}

// Format webhook status
function getStatusClass(status: string): string {
  switch (status) {
    case 'success':
      return 'bg-green-500/20 text-green-500'
    case 'failed':
      return 'bg-red-500/20 text-red-500'
    default:
      return 'bg-yellow-500/20 text-yellow-500'
  }
}

// Load history
async function loadHistory() {
  isHistoryLoading.value = true
  try {
    historyEntries.value = await historyService.getSiteHistory(siteId.value, 20)
  } catch {
    // Silent fail
  } finally {
    isHistoryLoading.value = false
  }
}

// Restore from history
async function restoreFromHistory(entry: HistoryEntry) {
  if (!confirm('Restaurer cette version ? Le contenu actuel sera remplace.')) {
    return
  }

  isRestoring.value = true
  try {
    await historyService.restore(siteId.value, entry.id)
    toast.success('Version restauree')
    // Reload history
    await loadHistory()
  } catch {
    toast.error('Erreur lors de la restauration')
  } finally {
    isRestoring.value = false
  }
}

// Get history entry label
function getHistoryLabel(entry: HistoryEntry): string {
  if (entry.fieldKey) {
    return `Champ: ${entry.fieldKey}`
  }
  if (entry.itemId) {
    return `Element: ${entry.itemId.slice(0, 8)}...`
  }
  return 'Modification'
}

// Toggle history entry expansion
function toggleHistoryExpand(id: string) {
  if (expandedHistory.value.has(id)) {
    expandedHistory.value.delete(id)
  } else {
    expandedHistory.value.add(id)
  }
  // Force reactivity
  expandedHistory.value = new Set(expandedHistory.value)
}

// Format history value for display
function formatHistoryValue(value: unknown): string {
  if (value === null || value === undefined) {
    return '(vide)'
  }
  if (typeof value === 'string') {
    return value
  }
  return JSON.stringify(value, null, 2)
}

// Initialize form with site data
function initForm(site: typeof sites.currentSite) {
  if (!site) return
  formName.value = site.name
  formUrl.value = site.url
  formWebhookUrl.value = site.webhookUrl || ''
}

// Validate form
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

// Start editing
function startEdit() {
  initForm(sites.currentSite)
  formErrors.value = {}
  isEditing.value = true
}

// Cancel editing
function cancelEdit() {
  initForm(sites.currentSite)
  formErrors.value = {}
  isEditing.value = false
}

// Save changes
async function saveChanges() {
  if (!validateForm()) return

  isSaving.value = true
  try {
    await sites.updateSite(siteId.value, {
      name: formName.value.trim(),
      url: formUrl.value.trim(),
      webhookUrl: formWebhookUrl.value.trim() || undefined,
    })
    toast.success('Site mis à jour')
    isEditing.value = false
  } catch {
    toast.error(sites.error || 'Erreur lors de la mise à jour')
  } finally {
    isSaving.value = false
  }
}

// Delete site
async function confirmDelete() {
  isDeleting.value = true
  try {
    await sites.deleteSite(siteId.value)
    toast.success('Site supprimé')
    router.push('/admin/sites')
  } catch {
    toast.error(sites.error || 'Erreur lors de la suppression')
    showDeleteModal.value = false
  } finally {
    isDeleting.value = false
  }
}

// Regenerate API key
async function confirmRegenerate() {
  isRegenerating.value = true
  try {
    await sites.regenerateApiKey(siteId.value)
    toast.success('Nouvelle clé API générée')
    showRegenerateModal.value = false
  } catch {
    toast.error(sites.error || 'Erreur lors de la régénération')
  } finally {
    isRegenerating.value = false
  }
}

// Copy to clipboard
async function copyToClipboard(text: string, label: string) {
  try {
    await navigator.clipboard.writeText(text)
    toast.success(`${label} copié`)
  } catch {
    toast.error('Impossible de copier')
  }
}

// Format date
function formatDate(date: Date | string): string {
  return new Date(date).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// ========== User Management ==========

function resetUserForm() {
  userEmail.value = ''
  userPassword.value = ''
  userFormErrors.value = {}
  editingUser.value = null
}

function openCreateUserModal() {
  resetUserForm()
  showUserModal.value = true
}

function openEditUserModal(user: User) {
  resetUserForm()
  editingUser.value = user
  userEmail.value = user.email
  showUserModal.value = true
}

function closeUserModal() {
  showUserModal.value = false
  resetUserForm()
}

function openDeleteUserModal(user: User) {
  userToDelete.value = user
  showDeleteUserModal.value = true
}

function closeDeleteUserModal() {
  showDeleteUserModal.value = false
  userToDelete.value = null
}

function validateUserForm(): boolean {
  userFormErrors.value = {}

  if (!userEmail.value.trim()) {
    userFormErrors.value.email = "L'email est requis"
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(userEmail.value)) {
    userFormErrors.value.email = 'Email invalide'
  }

  // Password required only for new users
  if (!editingUser.value && !userPassword.value) {
    userFormErrors.value.password = 'Le mot de passe est requis'
  } else if (userPassword.value && userPassword.value.length < 8) {
    userFormErrors.value.password = 'Le mot de passe doit contenir au moins 8 caractères'
  }

  return Object.keys(userFormErrors.value).length === 0
}

async function saveUser() {
  if (!validateUserForm()) return

  isUserSaving.value = true
  try {
    if (editingUser.value) {
      // Update existing user
      await usersStore.updateUser(siteId.value, editingUser.value.id, {
        email: userEmail.value.trim(),
        password: userPassword.value || undefined,
      })
      toast.success('Utilisateur mis à jour')
    } else {
      // Create new user
      await usersStore.createUser(siteId.value, {
        email: userEmail.value.trim(),
        password: userPassword.value,
      })
      toast.success('Utilisateur créé')
    }
    closeUserModal()
  } catch {
    toast.error(usersStore.error || "Erreur lors de l'enregistrement")
  } finally {
    isUserSaving.value = false
  }
}

async function confirmDeleteUser() {
  if (!userToDelete.value) return

  isUserDeleting.value = true
  try {
    await usersStore.deleteUser(siteId.value, userToDelete.value.id)
    toast.success('Utilisateur supprimé')
    closeDeleteUserModal()
  } catch {
    toast.error(usersStore.error || 'Erreur lors de la suppression')
  } finally {
    isUserDeleting.value = false
  }
}
</script>

<template>
  <div>
    <!-- Header -->
    <div class="flex items-center gap-4 mb-8">
      <router-link
        to="/admin/sites"
        class="glass-button p-2"
        title="Retour aux sites"
      >
        &larr;
      </router-link>
      <div class="flex-1">
        <h1 class="text-3xl font-bold">
          {{ sites.currentSite?.name || 'Chargement...' }}
        </h1>
        <a
          v-if="sites.currentSite"
          :href="sites.currentSite.url"
          target="_blank"
          rel="noopener"
          class="text-blue-500 hover:underline text-sm"
        >
          {{ sites.currentSite.url }}
        </a>
      </div>
      <div class="flex gap-2">
        <a
          v-if="sites.currentSite"
          :href="`${sites.currentSite.url}?edit=true`"
          target="_blank"
          rel="noopener"
          class="glass-button px-4 py-2"
          title="Ouvrir le site en mode édition"
        >
          Éditer sur le site
        </a>
        <router-link
          v-if="sites.currentSite?.schema"
          :to="`/admin/sites/${siteId}/content`"
          class="btn-primary px-4 py-2"
        >
          Éditer le contenu
        </router-link>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="sites.isLoading && !sites.currentSite" class="glass-card p-12 text-center">
      <p class="text-gray-500">Chargement...</p>
    </div>

    <!-- Content -->
    <div v-else-if="sites.currentSite" class="space-y-6">
      <!-- Info Card -->
      <div class="glass-card p-6">
        <div class="flex items-center justify-between mb-6">
          <h2 class="text-xl font-semibold">Informations</h2>
          <div v-if="!isEditing" class="flex gap-2">
            <button @click="startEdit" class="glass-button px-4 py-2 text-sm">
              Modifier
            </button>
            <button
              @click="showDeleteModal = true"
              class="glass-button px-4 py-2 text-sm text-red-500"
            >
              Supprimer
            </button>
          </div>
          <div v-else class="flex gap-2">
            <button
              @click="cancelEdit"
              class="glass-button px-4 py-2 text-sm"
              :disabled="isSaving"
            >
              Annuler
            </button>
            <button
              @click="saveChanges"
              class="btn-primary px-4 py-2 text-sm"
              :disabled="isSaving"
            >
              {{ isSaving ? 'Enregistrement...' : 'Enregistrer' }}
            </button>
          </div>
        </div>

        <!-- View Mode -->
        <div v-if="!isEditing" class="space-y-4">
          <div>
            <label class="text-sm text-gray-500 dark:text-gray-400">Nom</label>
            <p class="font-medium">{{ sites.currentSite.name }}</p>
          </div>
          <div>
            <label class="text-sm text-gray-500 dark:text-gray-400">URL</label>
            <p class="font-medium">{{ sites.currentSite.url }}</p>
          </div>
          <div>
            <label class="text-sm text-gray-500 dark:text-gray-400">Webhook URL</label>
            <p class="font-medium">
              {{ sites.currentSite.webhookUrl || 'Non configuré' }}
            </p>
          </div>
          <div>
            <label class="text-sm text-gray-500 dark:text-gray-400">Créé le</label>
            <p class="font-medium">{{ formatDate(sites.currentSite.createdAt) }}</p>
          </div>
          <div>
            <label class="text-sm text-gray-500 dark:text-gray-400">Dernière modification</label>
            <p class="font-medium">{{ formatDate(sites.currentSite.updatedAt) }}</p>
          </div>
        </div>

        <!-- Edit Mode -->
        <form v-else @submit.prevent="saveChanges" class="space-y-4">
          <div>
            <label for="edit-name" class="block text-sm font-medium mb-1">
              Nom <span class="text-red-500">*</span>
            </label>
            <input
              id="edit-name"
              v-model="formName"
              type="text"
              class="input-field"
              :class="{ 'border-red-500': formErrors.name }"
            />
            <p v-if="formErrors.name" class="text-red-500 text-xs mt-1">
              {{ formErrors.name }}
            </p>
          </div>

          <div>
            <label for="edit-url" class="block text-sm font-medium mb-1">
              URL <span class="text-red-500">*</span>
            </label>
            <input
              id="edit-url"
              v-model="formUrl"
              type="url"
              class="input-field"
              :class="{ 'border-red-500': formErrors.url }"
            />
            <p v-if="formErrors.url" class="text-red-500 text-xs mt-1">
              {{ formErrors.url }}
            </p>
          </div>

          <div>
            <label for="edit-webhook" class="block text-sm font-medium mb-1">
              Webhook URL <span class="text-gray-400 text-xs">(optionnel)</span>
            </label>
            <input
              id="edit-webhook"
              v-model="formWebhookUrl"
              type="url"
              class="input-field"
              :class="{ 'border-red-500': formErrors.webhookUrl }"
            />
            <p v-if="formErrors.webhookUrl" class="text-red-500 text-xs mt-1">
              {{ formErrors.webhookUrl }}
            </p>
          </div>
        </form>
      </div>

      <!-- API Key Card -->
      <div class="glass-card p-6">
        <h2 class="text-xl font-semibold mb-4">Clé API</h2>
        <p class="text-sm text-gray-500 dark:text-gray-400 mb-4">
          Utilisez cette clé pour authentifier les requêtes depuis votre site.
        </p>

        <div class="flex items-center gap-3 bg-black/20 rounded-lg p-4 mb-4">
          <code class="flex-1 font-mono text-sm break-all">
            {{ sites.currentSite.apiKey }}
          </code>
          <button
            @click="copyToClipboard(sites.currentSite.apiKey, 'Clé API')"
            class="glass-button px-3 py-1.5 text-sm shrink-0"
          >
            Copier
          </button>
        </div>

        <button
          @click="showRegenerateModal = true"
          class="text-sm text-orange-500 hover:underline"
        >
          Régénérer la clé API
        </button>
        <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
          Attention : l'ancienne clé cessera immédiatement de fonctionner.
        </p>
      </div>

      <!-- Integration Card -->
      <div class="glass-card p-6">
        <h2 class="text-xl font-semibold mb-4">Intégration</h2>
        <p class="text-sm text-gray-500 dark:text-gray-400 mb-4">
          Ajoutez ce script à votre site pour activer l'édition de contenu.
        </p>

        <div class="bg-black/20 rounded-lg p-4">
          <code class="text-sm font-mono text-green-400 break-all">
            &lt;script src="{{ originUrl }}/loader.js" data-site="{{ sites.currentSite.apiKey }}"&gt;&lt;/script&gt;
          </code>
        </div>

        <button
          @click="copyToClipboard(
            `<script src=&quot;${originUrl}/loader.js&quot; data-site=&quot;${sites.currentSite.apiKey}&quot;></script>`,
            'Script'
          )"
          class="mt-3 glass-button px-4 py-2 text-sm"
        >
          Copier le script
        </button>
      </div>

      <!-- Schema Card -->
      <div class="glass-card p-6">
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-xl font-semibold">Schéma de contenu</h2>
          <span
            v-if="sites.currentSite.schema"
            class="px-2 py-1 text-xs bg-green-500/20 text-green-500 rounded"
          >
            Configuré
          </span>
          <span
            v-else
            class="px-2 py-1 text-xs bg-gray-500/20 text-gray-400 rounded"
          >
            Non configuré
          </span>
        </div>
        <p class="text-sm text-gray-500 dark:text-gray-400 mb-4">
          Définissez les champs éditables de votre site en YAML.
        </p>

        <div v-if="isSchemaLoading" class="text-center py-8">
          <p class="text-gray-500">Chargement...</p>
        </div>

        <SchemaEditor
          v-else
          :site-id="siteId"
          :initial-yaml="schemaYaml"
          @saved="onSchemaSaved"
          @cleared="onSchemaCleared"
        />
      </div>

      <!-- Users Card -->
      <div class="glass-card p-6">
        <div class="flex items-center justify-between mb-6">
          <h2 class="text-xl font-semibold">
            Utilisateurs ({{ usersStore.usersCount }})
          </h2>
          <button @click="openCreateUserModal" class="btn-primary px-4 py-2 text-sm">
            + Nouvel utilisateur
          </button>
        </div>

        <!-- Empty state -->
        <div v-if="!usersStore.hasUsers" class="text-center py-8">
          <p class="text-gray-500 dark:text-gray-400 mb-2">
            Aucun utilisateur pour ce site.
          </p>
          <p class="text-sm text-gray-400 dark:text-gray-500">
            Les utilisateurs peuvent se connecter pour modifier le contenu du site.
          </p>
        </div>

        <!-- Users list -->
        <div v-else class="space-y-3">
          <div
            v-for="user in usersStore.users"
            :key="user.id"
            class="flex items-center justify-between p-4 bg-black/10 rounded-lg"
          >
            <div>
              <p class="font-medium">{{ user.email }}</p>
              <p class="text-xs text-gray-500 dark:text-gray-400">
                Créé le {{ formatDate(user.createdAt) }}
              </p>
            </div>
            <div class="flex gap-2">
              <button
                @click="openEditUserModal(user)"
                class="glass-button px-3 py-1.5 text-sm"
              >
                Modifier
              </button>
              <button
                @click="openDeleteUserModal(user)"
                class="glass-button px-3 py-1.5 text-sm text-red-500"
              >
                Supprimer
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Webhooks Card -->
      <div v-if="sites.currentSite.webhookUrl" class="glass-card p-6">
        <div class="flex items-center justify-between mb-6">
          <h2 class="text-xl font-semibold">Webhooks</h2>
          <button
            @click="sendTestWebhook"
            class="glass-button px-4 py-2 text-sm"
            :disabled="isSendingTest"
          >
            {{ isSendingTest ? 'Envoi...' : 'Envoyer un test' }}
          </button>
        </div>

        <p class="text-sm text-gray-500 dark:text-gray-400 mb-4">
          Les webhooks sont envoyes a <code class="text-blue-400">{{ sites.currentSite.webhookUrl }}</code>
          lors des modifications de contenu.
        </p>

        <!-- Loading -->
        <div v-if="isWebhookLoading" class="text-center py-4">
          <p class="text-gray-500">Chargement...</p>
        </div>

        <!-- Empty state -->
        <div v-else-if="webhookLogs.length === 0" class="text-center py-8 bg-black/10 rounded-lg">
          <p class="text-gray-500">Aucun webhook envoye pour le moment.</p>
        </div>

        <!-- Logs list -->
        <div v-else class="space-y-2 max-h-64 overflow-y-auto">
          <div
            v-for="log in webhookLogs"
            :key="log.id"
            class="flex items-center justify-between p-3 bg-black/10 rounded-lg text-sm"
          >
            <div class="flex items-center gap-3">
              <span
                :class="['px-2 py-0.5 rounded text-xs', getStatusClass(log.status)]"
              >
                {{ log.status }}
              </span>
              <span class="text-gray-400">{{ log.payload.event }}</span>
            </div>
            <div class="flex items-center gap-3 text-gray-500">
              <span v-if="log.responseCode">{{ log.responseCode }}</span>
              <span v-if="log.attempts > 1">({{ log.attempts }} essais)</span>
              <span>{{ formatDate(log.createdAt) }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- History Card -->
      <div class="glass-card p-6">
        <div class="flex items-center justify-between mb-6">
          <h2 class="text-xl font-semibold">Historique des modifications</h2>
          <button
            @click="loadHistory"
            class="glass-button px-3 py-1.5 text-sm"
            :disabled="isHistoryLoading"
          >
            Actualiser
          </button>
        </div>

        <!-- Loading -->
        <div v-if="isHistoryLoading" class="text-center py-4">
          <p class="text-gray-500">Chargement...</p>
        </div>

        <!-- Empty state -->
        <div v-else-if="historyEntries.length === 0" class="text-center py-8 bg-black/10 rounded-lg">
          <p class="text-gray-500">Aucune modification enregistree.</p>
        </div>

        <!-- History list -->
        <div v-else class="space-y-3 max-h-[600px] overflow-y-auto">
          <div
            v-for="entry in historyEntries"
            :key="entry.id"
            class="bg-black/10 rounded-lg text-sm overflow-hidden"
          >
            <!-- Header -->
            <div
              class="flex items-center justify-between p-3 cursor-pointer hover:bg-black/5"
              @click="toggleHistoryExpand(entry.id)"
            >
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2">
                  <span class="font-medium">{{ getHistoryLabel(entry) }}</span>
                  <span v-if="entry.user" class="text-gray-500 text-xs">
                    par {{ entry.user.email }}
                  </span>
                </div>
                <p class="text-xs text-gray-500 mt-1">
                  {{ formatDate(entry.changedAt) }}
                </p>
              </div>
              <div class="flex items-center gap-2">
                <button
                  @click.stop="restoreFromHistory(entry)"
                  class="glass-button px-2 py-1 text-xs"
                  :disabled="isRestoring"
                >
                  Restaurer
                </button>
                <span class="text-gray-400 text-xs">
                  {{ expandedHistory.has(entry.id) ? '▼' : '▶' }}
                </span>
              </div>
            </div>

            <!-- Details (expanded) -->
            <div v-if="expandedHistory.has(entry.id)" class="border-t border-white/10 p-3 space-y-3">
              <!-- Old value -->
              <div>
                <p class="text-xs text-red-400 font-medium mb-1">Ancienne valeur:</p>
                <pre class="text-xs bg-black/20 p-2 rounded overflow-x-auto max-h-32 text-red-300">{{ formatHistoryValue(entry.oldValue) }}</pre>
              </div>
              <!-- New value -->
              <div>
                <p class="text-xs text-green-400 font-medium mb-1">Nouvelle valeur:</p>
                <pre class="text-xs bg-black/20 p-2 rounded overflow-x-auto max-h-32 text-green-300">{{ formatHistoryValue(entry.newValue) }}</pre>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Delete Confirmation Modal -->
    <Modal :open="showDeleteModal" title="Supprimer le site" @close="showDeleteModal = false">
      <p class="text-gray-600 dark:text-gray-300 mb-4">
        Êtes-vous sûr de vouloir supprimer <strong>{{ sites.currentSite?.name }}</strong> ?
      </p>
      <p class="text-sm text-red-500">
        Cette action est irréversible. Tout le contenu associé sera également supprimé.
      </p>

      <template #footer>
        <button
          class="glass-button px-4 py-2"
          @click="showDeleteModal = false"
          :disabled="isDeleting"
        >
          Annuler
        </button>
        <button
          class="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition-colors"
          @click="confirmDelete"
          :disabled="isDeleting"
        >
          {{ isDeleting ? 'Suppression...' : 'Supprimer' }}
        </button>
      </template>
    </Modal>

    <!-- Regenerate Key Modal -->
    <Modal
      :open="showRegenerateModal"
      title="Régénérer la clé API"
      @close="showRegenerateModal = false"
    >
      <p class="text-gray-600 dark:text-gray-300 mb-4">
        Êtes-vous sûr de vouloir régénérer la clé API ?
      </p>
      <p class="text-sm text-orange-500">
        L'ancienne clé cessera immédiatement de fonctionner. Vous devrez mettre à jour
        votre site avec la nouvelle clé.
      </p>

      <template #footer>
        <button
          class="glass-button px-4 py-2"
          @click="showRegenerateModal = false"
          :disabled="isRegenerating"
        >
          Annuler
        </button>
        <button
          class="bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-lg transition-colors"
          @click="confirmRegenerate"
          :disabled="isRegenerating"
        >
          {{ isRegenerating ? 'Régénération...' : 'Régénérer' }}
        </button>
      </template>
    </Modal>

    <!-- User Create/Edit Modal -->
    <Modal
      :open="showUserModal"
      :title="editingUser ? 'Modifier l\'utilisateur' : 'Nouvel utilisateur'"
      @close="closeUserModal"
    >
      <form @submit.prevent="saveUser" class="space-y-4">
        <div>
          <label for="user-email" class="block text-sm font-medium mb-1">
            Email <span class="text-red-500">*</span>
          </label>
          <input
            id="user-email"
            v-model="userEmail"
            type="email"
            class="input-field"
            placeholder="utilisateur@exemple.com"
            :class="{ 'border-red-500': userFormErrors.email }"
          />
          <p v-if="userFormErrors.email" class="text-red-500 text-xs mt-1">
            {{ userFormErrors.email }}
          </p>
        </div>

        <div>
          <label for="user-password" class="block text-sm font-medium mb-1">
            Mot de passe
            <span v-if="!editingUser" class="text-red-500">*</span>
            <span v-else class="text-gray-400 text-xs">(laisser vide pour ne pas modifier)</span>
          </label>
          <input
            id="user-password"
            v-model="userPassword"
            type="password"
            class="input-field"
            placeholder="••••••••"
            :class="{ 'border-red-500': userFormErrors.password }"
          />
          <p v-if="userFormErrors.password" class="text-red-500 text-xs mt-1">
            {{ userFormErrors.password }}
          </p>
          <p v-if="!editingUser" class="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Au moins 8 caractères
          </p>
        </div>
      </form>

      <template #footer>
        <button
          type="button"
          class="glass-button px-4 py-2"
          @click="closeUserModal"
          :disabled="isUserSaving"
        >
          Annuler
        </button>
        <button
          type="submit"
          class="btn-primary px-4 py-2"
          :disabled="isUserSaving"
          @click="saveUser"
        >
          {{ isUserSaving ? 'Enregistrement...' : (editingUser ? 'Enregistrer' : 'Créer') }}
        </button>
      </template>
    </Modal>

    <!-- Delete User Modal -->
    <Modal
      :open="showDeleteUserModal"
      title="Supprimer l'utilisateur"
      @close="closeDeleteUserModal"
    >
      <p class="text-gray-600 dark:text-gray-300 mb-4">
        Êtes-vous sûr de vouloir supprimer l'utilisateur
        <strong>{{ userToDelete?.email }}</strong> ?
      </p>
      <p class="text-sm text-red-500">
        Cette action est irréversible.
      </p>

      <template #footer>
        <button
          class="glass-button px-4 py-2"
          @click="closeDeleteUserModal"
          :disabled="isUserDeleting"
        >
          Annuler
        </button>
        <button
          class="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition-colors"
          @click="confirmDeleteUser"
          :disabled="isUserDeleting"
        >
          {{ isUserDeleting ? 'Suppression...' : 'Supprimer' }}
        </button>
      </template>
    </Modal>
  </div>
</template>
