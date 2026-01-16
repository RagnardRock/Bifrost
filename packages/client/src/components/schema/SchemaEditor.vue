<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { schemaService } from '@/services/schema.service'
import { useToastStore } from '@/stores/toast.store'

const props = defineProps<{
  siteId: string
  initialYaml?: string | null
}>()

const emit = defineEmits<{
  saved: [yaml: string]
  cleared: []
}>()

const toast = useToastStore()

// State
const yaml = ref(props.initialYaml || '')
const isLoading = ref(false)
const isSaving = ref(false)
const isValidating = ref(false)
const validationErrors = ref<string[]>([])
const isValid = ref<boolean | null>(null)

// Watch for initial yaml changes
watch(
  () => props.initialYaml,
  (newYaml) => {
    if (newYaml !== undefined) {
      yaml.value = newYaml || ''
    }
  }
)

// Has changes
const hasChanges = computed(() => {
  return yaml.value !== (props.initialYaml || '')
})

// Validate schema
async function validateSchema() {
  if (!yaml.value.trim()) {
    validationErrors.value = ['Le schéma YAML est vide']
    isValid.value = false
    return
  }

  isValidating.value = true
  try {
    const result = await schemaService.validateSchema(props.siteId, yaml.value)
    isValid.value = result.valid
    validationErrors.value = result.errors || []
  } catch (e: any) {
    validationErrors.value = [e.response?.data?.error?.message || 'Erreur de validation']
    isValid.value = false
  } finally {
    isValidating.value = false
  }
}

// Save schema
async function saveSchema() {
  if (!yaml.value.trim()) {
    toast.error('Le schéma YAML est vide')
    return
  }

  isSaving.value = true
  try {
    await schemaService.updateSchema(props.siteId, yaml.value)
    toast.success('Schéma enregistré')
    isValid.value = true
    validationErrors.value = []
    emit('saved', yaml.value)
  } catch (e: any) {
    const error = e.response?.data?.error
    if (error?.details?.errors) {
      validationErrors.value = error.details.errors
      isValid.value = false
    } else {
      toast.error(error?.message || 'Erreur lors de l\'enregistrement')
    }
  } finally {
    isSaving.value = false
  }
}

// Clear schema
async function clearSchema() {
  if (!confirm('Êtes-vous sûr de vouloir supprimer le schéma ?')) {
    return
  }

  isLoading.value = true
  try {
    await schemaService.clearSchema(props.siteId)
    yaml.value = ''
    isValid.value = null
    validationErrors.value = []
    toast.success('Schéma supprimé')
    emit('cleared')
  } catch (e: any) {
    toast.error(e.response?.data?.error?.message || 'Erreur lors de la suppression')
  } finally {
    isLoading.value = false
  }
}

// Load example
async function loadExample() {
  if (yaml.value.trim() && !confirm('Remplacer le contenu actuel par l\'exemple ?')) {
    return
  }

  isLoading.value = true
  try {
    const result = await schemaService.getExample()
    yaml.value = result.yaml
    isValid.value = null
    validationErrors.value = []
  } catch (e: any) {
    toast.error('Erreur lors du chargement de l\'exemple')
  } finally {
    isLoading.value = false
  }
}

// Reset changes
function resetChanges() {
  yaml.value = props.initialYaml || ''
  isValid.value = null
  validationErrors.value = []
}
</script>

<template>
  <div class="space-y-4">
    <!-- Toolbar -->
    <div class="flex items-center justify-between gap-4 flex-wrap">
      <div class="flex gap-2">
        <button
          @click="validateSchema"
          :disabled="isValidating || !yaml.trim()"
          class="glass-button px-3 py-1.5 text-sm"
        >
          {{ isValidating ? 'Validation...' : 'Valider' }}
        </button>
        <button
          @click="loadExample"
          :disabled="isLoading"
          class="glass-button px-3 py-1.5 text-sm"
        >
          Charger exemple
        </button>
      </div>
      <div class="flex gap-2">
        <button
          v-if="hasChanges"
          @click="resetChanges"
          class="glass-button px-3 py-1.5 text-sm"
        >
          Annuler
        </button>
        <button
          v-if="initialYaml"
          @click="clearSchema"
          :disabled="isLoading"
          class="glass-button px-3 py-1.5 text-sm text-red-500"
        >
          Supprimer
        </button>
        <button
          @click="saveSchema"
          :disabled="isSaving || !yaml.trim()"
          class="btn-primary px-4 py-1.5 text-sm"
        >
          {{ isSaving ? 'Enregistrement...' : 'Enregistrer' }}
        </button>
      </div>
    </div>

    <!-- Validation status -->
    <div
      v-if="isValid !== null"
      :class="[
        'px-4 py-2 rounded-lg text-sm',
        isValid
          ? 'bg-green-500/10 border border-green-500/30 text-green-500'
          : 'bg-red-500/10 border border-red-500/30 text-red-500',
      ]"
    >
      <div v-if="isValid" class="flex items-center gap-2">
        <span>✓</span>
        <span>Schéma valide</span>
      </div>
      <div v-else>
        <p class="font-medium mb-1">Erreurs de validation :</p>
        <ul class="list-disc list-inside space-y-1">
          <li v-for="(error, i) in validationErrors" :key="i">{{ error }}</li>
        </ul>
      </div>
    </div>

    <!-- Editor -->
    <div class="relative">
      <textarea
        v-model="yaml"
        class="w-full h-96 font-mono text-sm bg-black/30 border border-white/10 rounded-lg p-4 resize-y focus:outline-none focus:border-blue-500/50"
        placeholder="# Définissez votre schéma YAML ici...
#
# fields:
#   hero_title:
#     type: text
#     label: Titre principal
#     selector: '#hero h1'
#
# collections:
#   blog_posts:
#     label: Articles
#     fields:
#       title:
#         type: text
#         label: Titre"
        spellcheck="false"
      ></textarea>
      <div class="absolute bottom-2 right-2 text-xs text-gray-500">
        {{ yaml.split('\n').length }} lignes
      </div>
    </div>

    <!-- Help -->
    <details class="text-sm">
      <summary class="cursor-pointer text-gray-500 hover:text-gray-400">
        Aide sur la syntaxe
      </summary>
      <div class="mt-3 p-4 bg-black/20 rounded-lg space-y-3">
        <div>
          <h4 class="font-medium mb-1">Types de champs disponibles :</h4>
          <ul class="text-gray-400 space-y-1">
            <li><code class="text-blue-400">text</code> - Texte simple</li>
            <li><code class="text-blue-400">richtext</code> - Texte riche (HTML)</li>
            <li><code class="text-blue-400">image</code> - Image (upload vers Cloudinary)</li>
            <li><code class="text-blue-400">date</code> - Date</li>
            <li><code class="text-blue-400">number</code> - Nombre</li>
            <li><code class="text-blue-400">boolean</code> - Oui/Non</li>
          </ul>
        </div>
        <div>
          <h4 class="font-medium mb-1">Structure :</h4>
          <ul class="text-gray-400 space-y-1">
            <li><code class="text-purple-400">fields</code> - Champs individuels du site</li>
            <li><code class="text-purple-400">groups</code> - Groupement de champs pour l'interface</li>
            <li><code class="text-purple-400">collections</code> - Listes d'éléments (blog, témoignages...)</li>
          </ul>
        </div>
      </div>
    </details>
  </div>
</template>
