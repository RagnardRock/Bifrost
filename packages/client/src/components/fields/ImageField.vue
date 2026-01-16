<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRoute } from 'vue-router'
import { uploadService } from '@/services/upload.service'
import { useToastStore } from '@/stores/toast.store'

const props = defineProps<{
  modelValue: string
  label: string
  fieldKey: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const route = useRoute()
const toast = useToastStore()

const isUploading = ref(false)
const uploadError = ref<string | null>(null)
const fileInput = ref<HTMLInputElement | null>(null)

// Detect if we're in admin or client context
const isAdminContext = computed(() => route.path.startsWith('/admin'))

const value = computed({
  get: () => props.modelValue || '',
  set: (v) => emit('update:modelValue', v),
})

const hasImage = computed(() => !!value.value)

function triggerUpload() {
  fileInput.value?.click()
}

async function handleFileChange(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  // Validate file type
  if (!file.type.startsWith('image/')) {
    toast.error('Veuillez selectionner une image')
    return
  }

  // Validate file size (max 5MB)
  if (file.size > 5 * 1024 * 1024) {
    toast.error('L\'image ne doit pas depasser 5 Mo')
    return
  }

  isUploading.value = true
  uploadError.value = null

  try {
    // Upload to Cloudinary via appropriate endpoint
    const result = isAdminContext.value
      ? await uploadService.uploadImageAdmin(file)
      : await uploadService.uploadImageClient(file)

    value.value = result.url
    toast.success('Image telechargee')
  } catch (error: any) {
    uploadError.value = error.response?.data?.error?.message || 'Erreur lors du telechargement'
    toast.error(uploadError.value!)

    // Fallback to data URL if upload fails
    const reader = new FileReader()
    reader.onload = (e) => {
      value.value = e.target?.result as string
    }
    reader.readAsDataURL(file)
  } finally {
    isUploading.value = false
    // Reset input
    input.value = ''
  }
}

function clearImage() {
  value.value = ''
}
</script>

<template>
  <div>
    <label class="block text-sm font-medium mb-2">
      {{ label }}
    </label>

    <!-- Image preview -->
    <div
      v-if="hasImage"
      class="relative group rounded-lg overflow-hidden bg-black/20 mb-2"
    >
      <img
        :src="value"
        :alt="label"
        class="w-full h-48 object-cover"
      />
      <div
        class="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2"
      >
        <button
          @click="triggerUpload"
          class="glass-button px-3 py-1.5 text-sm"
        >
          Changer
        </button>
        <button
          @click="clearImage"
          class="glass-button px-3 py-1.5 text-sm text-red-500"
        >
          Supprimer
        </button>
      </div>
    </div>

    <!-- Upload zone -->
    <div
      v-else
      @click="triggerUpload"
      class="border-2 border-dashed border-white/20 rounded-lg p-8 text-center cursor-pointer hover:border-blue-500/50 transition-colors"
    >
      <div v-if="isUploading" class="text-gray-500">
        Chargement...
      </div>
      <div v-else>
        <p class="text-gray-500 mb-2">Cliquez pour ajouter une image</p>
        <p class="text-xs text-gray-600">PNG, JPG, WebP - Max 5 Mo</p>
      </div>
    </div>

    <input
      ref="fileInput"
      type="file"
      accept="image/*"
      class="hidden"
      @change="handleFileChange"
    />
  </div>
</template>
