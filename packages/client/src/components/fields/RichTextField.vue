<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  modelValue: string
  label: string
  fieldKey: string
  placeholder?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const value = computed({
  get: () => props.modelValue || '',
  set: (v) => emit('update:modelValue', v),
})
</script>

<template>
  <div>
    <label :for="fieldKey" class="block text-sm font-medium mb-1">
      {{ label }}
    </label>
    <textarea
      :id="fieldKey"
      v-model="value"
      class="input-field min-h-32 resize-y"
      :placeholder="placeholder"
    ></textarea>
    <p class="text-xs text-gray-500 mt-1">
      Supporte le HTML basique (gras, italique, liens)
    </p>
  </div>
</template>
