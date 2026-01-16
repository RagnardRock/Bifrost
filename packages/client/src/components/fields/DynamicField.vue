<script setup lang="ts">
import { computed } from 'vue'
import type { FieldDefinition, FieldType } from '@bifrost/shared'
import TextField from './TextField.vue'
import RichTextField from './RichTextField.vue'
import ImageField from './ImageField.vue'
import DateField from './DateField.vue'
import NumberField from './NumberField.vue'
import BooleanField from './BooleanField.vue'

const props = defineProps<{
  modelValue: unknown
  fieldKey: string
  definition: FieldDefinition
}>()

const emit = defineEmits<{
  'update:modelValue': [value: unknown]
}>()

const value = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v),
})

const componentMap: Record<FieldType, any> = {
  text: TextField,
  richtext: RichTextField,
  image: ImageField,
  date: DateField,
  number: NumberField,
  boolean: BooleanField,
}

const component = computed(() => componentMap[props.definition.type] || TextField)
</script>

<template>
  <component
    :is="component"
    v-model="value"
    :field-key="fieldKey"
    :label="definition.label"
  />
</template>
