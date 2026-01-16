<script setup lang="ts">
import { ref, computed } from 'vue'
import type { CollectionDefinition } from '@bifrost/shared'
import type { CollectionItem } from '@/services/collections.service'
import { useCollectionsStore } from '@/stores/collections.store'
import { useToastStore } from '@/stores/toast.store'
import Modal from '@/components/ui/Modal.vue'
import DynamicField from '@/components/fields/DynamicField.vue'

const props = defineProps<{
  siteId: string
  collectionType: string
  definition: CollectionDefinition
  items: CollectionItem[]
}>()

const collections = useCollectionsStore()
const toast = useToastStore()

// Modal state
const showItemModal = ref(false)
const showDeleteModal = ref(false)
const editingItem = ref<CollectionItem | null>(null)
const itemToDelete = ref<CollectionItem | null>(null)

// Form state
const formData = ref<Record<string, unknown>>({})

// Get item preview (first text field value)
function getItemPreview(item: CollectionItem): string {
  const fields = props.definition.fields
  for (const [key, def] of Object.entries(fields)) {
    if (def.type === 'text' && item.data[key]) {
      return String(item.data[key]).slice(0, 50) + (String(item.data[key]).length > 50 ? '...' : '')
    }
  }
  return `Élément #${item.position + 1}`
}

// Initialize form with empty or existing data
function initForm(item?: CollectionItem) {
  formData.value = {}
  const fields = props.definition.fields

  for (const key of Object.keys(fields)) {
    if (item) {
      formData.value[key] = item.data[key] ?? null
    } else {
      formData.value[key] = null
    }
  }
}

// Open create modal
function openCreateModal() {
  editingItem.value = null
  initForm()
  showItemModal.value = true
}

// Open edit modal
function openEditModal(item: CollectionItem) {
  editingItem.value = item
  initForm(item)
  showItemModal.value = true
}

// Close item modal
function closeItemModal() {
  showItemModal.value = false
  editingItem.value = null
  formData.value = {}
}

// Open delete modal
function openDeleteModal(item: CollectionItem) {
  itemToDelete.value = item
  showDeleteModal.value = true
}

// Close delete modal
function closeDeleteModal() {
  showDeleteModal.value = false
  itemToDelete.value = null
}

// Save item
async function saveItem() {
  try {
    if (editingItem.value) {
      await collections.updateItem(
        props.siteId,
        props.collectionType,
        editingItem.value.id,
        formData.value
      )
      toast.success('Élément mis à jour')
    } else {
      await collections.createItem(props.siteId, props.collectionType, formData.value)
      toast.success('Élément créé')
    }
    closeItemModal()
  } catch {
    toast.error(collections.error || 'Erreur lors de l\'enregistrement')
  }
}

// Delete item
async function confirmDelete() {
  if (!itemToDelete.value) return

  try {
    await collections.deleteItem(props.siteId, props.collectionType, itemToDelete.value.id)
    toast.success('Élément supprimé')
    closeDeleteModal()
  } catch {
    toast.error(collections.error || 'Erreur lors de la suppression')
  }
}

// Move item up
async function moveUp(index: number) {
  if (index === 0) return

  const itemIds = props.items.map((i) => i.id)
  ;[itemIds[index - 1], itemIds[index]] = [itemIds[index], itemIds[index - 1]]

  try {
    await collections.reorderItems(props.siteId, props.collectionType, itemIds)
  } catch {
    toast.error('Erreur lors du déplacement')
  }
}

// Move item down
async function moveDown(index: number) {
  if (index >= props.items.length - 1) return

  const itemIds = props.items.map((i) => i.id)
  ;[itemIds[index], itemIds[index + 1]] = [itemIds[index + 1], itemIds[index]]

  try {
    await collections.reorderItems(props.siteId, props.collectionType, itemIds)
  } catch {
    toast.error('Erreur lors du déplacement')
  }
}

// Field definitions as array for iteration
const fieldEntries = computed(() => Object.entries(props.definition.fields))
</script>

<template>
  <div class="space-y-4">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div>
        <h3 class="text-lg font-semibold">{{ definition.label }}</h3>
        <p class="text-sm text-gray-500">{{ items.length }} élément(s)</p>
      </div>
      <button @click="openCreateModal" class="btn-primary px-3 py-1.5 text-sm">
        + Ajouter
      </button>
    </div>

    <!-- Empty state -->
    <div v-if="items.length === 0" class="text-center py-8 bg-black/10 rounded-lg">
      <p class="text-gray-500 mb-2">Aucun élément dans cette collection.</p>
      <button @click="openCreateModal" class="text-blue-500 hover:underline text-sm">
        Créer le premier élément
      </button>
    </div>

    <!-- Items list -->
    <div v-else class="space-y-2">
      <div
        v-for="(item, index) in items"
        :key="item.id"
        class="flex items-center gap-3 p-3 bg-black/10 rounded-lg group"
      >
        <!-- Position controls -->
        <div class="flex flex-col gap-1">
          <button
            @click="moveUp(index)"
            :disabled="index === 0"
            class="p-1 text-xs opacity-50 hover:opacity-100 disabled:opacity-20 disabled:cursor-not-allowed"
            title="Monter"
          >
            ▲
          </button>
          <button
            @click="moveDown(index)"
            :disabled="index >= items.length - 1"
            class="p-1 text-xs opacity-50 hover:opacity-100 disabled:opacity-20 disabled:cursor-not-allowed"
            title="Descendre"
          >
            ▼
          </button>
        </div>

        <!-- Item preview -->
        <div class="flex-1 min-w-0">
          <p class="font-medium truncate">{{ getItemPreview(item) }}</p>
          <p class="text-xs text-gray-500">Position {{ index + 1 }}</p>
        </div>

        <!-- Actions -->
        <div class="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            @click="openEditModal(item)"
            class="glass-button px-2 py-1 text-xs"
          >
            Modifier
          </button>
          <button
            @click="openDeleteModal(item)"
            class="glass-button px-2 py-1 text-xs text-red-500"
          >
            Supprimer
          </button>
        </div>
      </div>
    </div>

    <!-- Item Create/Edit Modal -->
    <Modal
      :open="showItemModal"
      :title="editingItem ? 'Modifier l\'élément' : 'Nouvel élément'"
      @close="closeItemModal"
    >
      <form @submit.prevent="saveItem" class="space-y-4">
        <DynamicField
          v-for="[key, fieldDef] in fieldEntries"
          :key="key"
          :field-key="key"
          :definition="fieldDef"
          :model-value="formData[key]"
          @update:model-value="formData[key] = $event"
        />
      </form>

      <template #footer>
        <button
          type="button"
          class="glass-button px-4 py-2"
          @click="closeItemModal"
          :disabled="collections.isSaving"
        >
          Annuler
        </button>
        <button
          type="submit"
          class="btn-primary px-4 py-2"
          :disabled="collections.isSaving"
          @click="saveItem"
        >
          {{ collections.isSaving ? 'Enregistrement...' : (editingItem ? 'Enregistrer' : 'Créer') }}
        </button>
      </template>
    </Modal>

    <!-- Delete Confirmation Modal -->
    <Modal
      :open="showDeleteModal"
      title="Supprimer l'élément"
      @close="closeDeleteModal"
    >
      <p class="text-gray-600 dark:text-gray-300 mb-4">
        Êtes-vous sûr de vouloir supprimer cet élément ?
      </p>
      <p class="text-sm text-red-500">
        Cette action est irréversible.
      </p>

      <template #footer>
        <button
          class="glass-button px-4 py-2"
          @click="closeDeleteModal"
          :disabled="collections.isSaving"
        >
          Annuler
        </button>
        <button
          class="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition-colors"
          @click="confirmDelete"
          :disabled="collections.isSaving"
        >
          {{ collections.isSaving ? 'Suppression...' : 'Supprimer' }}
        </button>
      </template>
    </Modal>
  </div>
</template>
