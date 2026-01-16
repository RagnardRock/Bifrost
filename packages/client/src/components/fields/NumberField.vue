<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  modelValue: number | null
  label: string
  fieldKey: string
  min?: number
  max?: number
  step?: number
}>()

const emit = defineEmits<{
  'update:modelValue': [value: number | null]
}>()

const value = computed({
  get: () => props.modelValue ?? '',
  set: (v) => {
    if (v === '' || v === null) {
      emit('update:modelValue', null)
    } else {
      emit('update:modelValue', Number(v))
    }
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
      type="number"
      class="input-field"
      :min="min"
      :max="max"
      :step="step ?? 1"
    />
  </div>
</template>
