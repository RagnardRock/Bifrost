<script setup lang="ts">
import { computed } from 'vue'
import type { BifrostSchema, FieldDefinition } from '@bifrost/shared'
import DynamicField from '@/components/fields/DynamicField.vue'

const props = defineProps<{
  schema: BifrostSchema
  modelValue: Record<string, unknown>
}>()

const emit = defineEmits<{
  'update:modelValue': [value: Record<string, unknown>]
}>()

// Get field value
function getFieldValue(key: string): unknown {
  return props.modelValue[key]
}

// Update field value
function updateFieldValue(key: string, value: unknown) {
  emit('update:modelValue', {
    ...props.modelValue,
    [key]: value,
  })
}

// Compute grouped fields
const groupedFields = computed(() => {
  if (!props.schema.groups || !props.schema.fields) {
    return null
  }

  const result: Array<{
    key: string
    label: string
    fields: Array<{ key: string; definition: FieldDefinition }>
  }> = []

  // Track which fields are in groups
  const fieldsInGroups = new Set<string>()

  for (const [groupKey, group] of Object.entries(props.schema.groups)) {
    const groupFields: Array<{ key: string; definition: FieldDefinition }> = []

    for (const fieldKey of group.fields) {
      const definition = props.schema.fields[fieldKey]
      if (definition) {
        groupFields.push({ key: fieldKey, definition })
        fieldsInGroups.add(fieldKey)
      }
    }

    if (groupFields.length > 0) {
      result.push({
        key: groupKey,
        label: group.label,
        fields: groupFields,
      })
    }
  }

  return result
})

// Compute ungrouped fields
const ungroupedFields = computed(() => {
  if (!props.schema.fields) return []

  const fieldsInGroups = new Set<string>()

  if (props.schema.groups) {
    for (const group of Object.values(props.schema.groups)) {
      for (const fieldKey of group.fields) {
        fieldsInGroups.add(fieldKey)
      }
    }
  }

  return Object.entries(props.schema.fields)
    .filter(([key]) => !fieldsInGroups.has(key))
    .map(([key, definition]) => ({ key, definition }))
})

// Check if schema has fields
const hasFields = computed(() => {
  return props.schema.fields && Object.keys(props.schema.fields).length > 0
})
</script>

<template>
  <div class="space-y-8">
    <!-- No fields message -->
    <div v-if="!hasFields" class="text-center py-8 text-gray-500">
      Ce schéma ne définit aucun champ individuel.
    </div>

    <!-- Grouped fields -->
    <template v-if="groupedFields">
      <div
        v-for="group in groupedFields"
        :key="group.key"
        class="space-y-4"
      >
        <h3 class="text-lg font-semibold border-b border-white/10 pb-2">
          {{ group.label }}
        </h3>
        <div class="grid gap-4">
          <DynamicField
            v-for="field in group.fields"
            :key="field.key"
            :field-key="field.key"
            :definition="field.definition"
            :model-value="getFieldValue(field.key)"
            @update:model-value="updateFieldValue(field.key, $event)"
          />
        </div>
      </div>
    </template>

    <!-- Ungrouped fields -->
    <div v-if="ungroupedFields.length > 0" class="space-y-4">
      <h3
        v-if="groupedFields && groupedFields.length > 0"
        class="text-lg font-semibold border-b border-white/10 pb-2"
      >
        Autres champs
      </h3>
      <div class="grid gap-4">
        <DynamicField
          v-for="field in ungroupedFields"
          :key="field.key"
          :field-key="field.key"
          :definition="field.definition"
          :model-value="getFieldValue(field.key)"
          @update:model-value="updateFieldValue(field.key, $event)"
        />
      </div>
    </div>
  </div>
</template>
