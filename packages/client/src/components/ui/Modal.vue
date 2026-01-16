<script setup lang="ts">
import { watch, onMounted, onUnmounted } from 'vue'

const props = defineProps<{
  open: boolean
  title?: string
}>()

const emit = defineEmits<{
  close: []
}>()

function handleEscape(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    emit('close')
  }
}

watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
  }
)

onMounted(() => {
  window.addEventListener('keydown', handleEscape)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleEscape)
  document.body.style.overflow = ''
})
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div
        v-if="open"
        class="fixed inset-0 z-40 flex items-center justify-center p-4"
      >
        <!-- Backdrop -->
        <div
          class="absolute inset-0 bg-black/50 backdrop-blur-sm"
          @click="emit('close')"
        />

        <!-- Modal content -->
        <div
          class="glass-card relative z-10 w-full max-w-lg max-h-[90vh] overflow-auto"
        >
          <!-- Header -->
          <div
            v-if="title || $slots.header"
            class="flex items-center justify-between p-4 border-b border-white/10"
          >
            <slot name="header">
              <h2 class="text-xl font-semibold">{{ title }}</h2>
            </slot>
            <button
              @click="emit('close')"
              class="p-1 rounded hover:bg-white/10 transition-colors"
            >
              <span class="text-xl">&times;</span>
            </button>
          </div>

          <!-- Body -->
          <div class="p-4">
            <slot />
          </div>

          <!-- Footer -->
          <div
            v-if="$slots.footer"
            class="flex justify-end gap-3 p-4 border-t border-white/10"
          >
            <slot name="footer" />
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.2s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}
</style>
