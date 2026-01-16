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
    <input
      :id="fieldKey"
      v-model="value"
      type="text"
      class="input-field"
      :placeholder="placeholder"
    />
  </div>
</template>
