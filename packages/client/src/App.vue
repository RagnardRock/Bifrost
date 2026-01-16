<script setup lang="ts">
import { RouterView } from 'vue-router'
import { useUIStore } from '@/stores/ui.store'
import ToastContainer from '@/components/ui/ToastContainer.vue'

const ui = useUIStore()

// Initialize theme
ui.initTheme()
</script>

<template>
  <RouterView />
  <ToastContainer />
</template>
