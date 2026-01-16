<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  modelValue: string
  label: string
  fieldKey: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const value = computed({
  get: () => {
    if (!props.modelValue) return ''
    // Convert ISO string to date input format (YYYY-MM-DD)
    try {
      const date = new Date(props.modelValue)
      return date.toISOString().split('T')[0]
    } catch {
      return ''
    }
  },
  set: (v) => {
    if (!v) {
      emit('update:modelValue', '')
      return
    }
    // Convert to ISO string
    emit('update:modelValue', new Date(v).toISOString())
  },
})
</script>

<template>
  <div>
    <label :for="fieldKey" class="block text-sm font-medium mb-1">
      {{ label }}
    </label>
    <input
      :id="fieldKey"
      v-model="value"
      type="date"
      class="input-field"
    />
  </div>
</template>
