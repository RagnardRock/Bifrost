<script setup lang="ts">
import { useToastStore } from '@/stores/toast.store'

const toast = useToastStore()

const iconMap = {
  success: '✓',
  error: '✕',
  info: 'ℹ',
  warning: '⚠',
}

const colorMap = {
  success: 'bg-green-500/10 border-green-500/30 text-green-500',
  error: 'bg-red-500/10 border-red-500/30 text-red-500',
  info: 'bg-blue-500/10 border-blue-500/30 text-blue-500',
  warning: 'bg-yellow-500/10 border-yellow-500/30 text-yellow-500',
}
</script>

<template>
  <Teleport to="body">
    <div class="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm">
      <TransitionGroup name="toast">
        <div
          v-for="t in toast.toasts"
          :key="t.id"
          :class="[
            'flex items-center gap-3 px-4 py-3 rounded-lg border backdrop-blur-md shadow-lg',
            colorMap[t.type],
          ]"
        >
          <span class="text-lg font-bold">{{ iconMap[t.type] }}</span>
          <span class="flex-1 text-sm">{{ t.message }}</span>
          <button
            @click="toast.remove(t.id)"
            class="opacity-60 hover:opacity-100 transition-opacity"
          >
            ✕
          </button>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>

<style scoped>
.toast-enter-active,
.toast-leave-active {
  transition: all 0.3s ease;
}

.toast-enter-from {
  opacity: 0;
  transform: translateX(100%);
}

.toast-leave-to {
  opacity: 0;
  transform: translateX(100%);
}
</style>
