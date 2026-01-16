<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  modelValue: boolean
  label: string
  fieldKey: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()

const value = computed({
  get: () => !!props.modelValue,
  set: (v) => emit('update:modelValue', v),
})
</script>

<template>
  <div class="flex items-center gap-3">
    <button
      :id="fieldKey"
      type="button"
      role="switch"
      :aria-checked="value"
      @click="value = !value"
      :class="[
        'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-900',
        value ? 'bg-blue-600' : 'bg-gray-600',
      ]"
    >
      <span
        :class="[
          'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out',
          value ? 'translate-x-5' : 'translate-x-0',
        ]"
      />
    </button>
    <label :for="fieldKey" class="text-sm font-medium cursor-pointer">
      {{ label }}
    </label>
  </div>
</template>
