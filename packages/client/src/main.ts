import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import { router } from './router'
import '@fontsource-variable/inter'
import '@fontsource/noto-sans-runic'
import './styles/main.css'
import { ecouterInstallation, enregistrerServiceWorker } from './composables/installation'

// Appli installable : à écouter avant l'affichage
ecouterInstallation()
enregistrerServiceWorker()

const app = createApp(App)

app.use(createPinia())
app.use(router)

app.mount('#app')
