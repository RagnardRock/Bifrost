<script setup lang="ts">
/**
 * Mode dev : poser une rubrique (blog, actualités…) ou un fil qui en mélange plusieurs.
 * Rubrique : nom, champs des articles, nombre affiché (tous ou les N derniers), page de tous les articles.
 * Fil : rubriques à mélanger, titre, nombre affiché.
 */
import { computed, ref } from 'vue'
import type { ChampArticle, Rubrique } from '@/services/editeur.service'

const props = defineProps<{ mode: 'rubrique' | 'fil'; rubriques: Rubrique[]; occupe: boolean; libelleDepart?: string }>()
const emit = defineEmits<{
  rubrique: [o: { libelle: string; champs: ChampArticle[]; limite: number | null; pageComplete: boolean }]
  fil: [o: { rubriques: string[]; titre: string; limite: number | null }]
  fermer: []
}>()

const CHAMPS: { id: ChampArticle; libelle: string; aide: string }[] = [
  { id: 'photo', libelle: 'Photos', aide: 'en tête de la carte, et en galerie sur la page' },
  { id: 'date', libelle: 'Date', aide: 'sert aussi à trier les fils' },
  { id: 'resume', libelle: 'Résumé', aide: 'le début du texte, sur la carte' },
  { id: 'texte', libelle: 'Texte complet', aide: 'sur la page de l’article' },
  { id: 'auteur', libelle: 'Auteur', aide: '« Par … »' },
  { id: 'categorie', libelle: 'Catégorie', aide: 'petit badge' },
  { id: 'lien', libelle: 'Lien externe', aide: 'un bouton vers un autre site' },
]

const libelle = ref(props.libelleDepart ?? '')
const champs = ref<ChampArticle[]>(['photo', 'date', 'resume', 'texte'])
const tous = ref(true)
const nombre = ref(3)
const pageComplete = ref(true)
const nomTechnique = computed(() => libelle.value.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40))
const existante = computed(() => props.rubriques.find((r) => r.nom === nomTechnique.value) ?? null)

const choisies = ref<string[]>(props.rubriques.map((r) => r.nom))
const titreFil = ref('Les dernières nouvelles')

const valide = computed(() => props.mode === 'rubrique'
  ? !!nomTechnique.value && nomTechnique.value !== 'photos' && (tous.value || nombre.value >= 1)
  : choisies.value.length > 0 && !!titreFil.value.trim() && (tous.value || nombre.value >= 1))

function valider() {
  if (!valide.value || props.occupe) return
  const limite = tous.value ? null : Math.max(1, Math.min(100, Math.round(nombre.value)))
  if (props.mode === 'rubrique') emit('rubrique', { libelle: libelle.value.trim(), champs: champs.value, limite, pageComplete: !!limite && pageComplete.value })
  else emit('fil', { rubriques: choisies.value, titre: titreFil.value.trim(), limite })
}
</script>

<template>
  <div class="dr-fond" @click.self="emit('fermer')">
    <form class="dr" @submit.prevent="valider">
      <template v-if="mode === 'rubrique'">
        <h2>📰 Rubrique d’articles</h2>
        <p class="dr-note">Une liste d’articles (blog, actualités, Instagram…). Chaque article a sa page. Le client en ajoute avec le bouton « + » de l’éditeur.</p>
        <label>Nom de la rubrique<input v-model="libelle" required maxlength="60" placeholder="Ex. : Blog, Instagram, Nos sorties" autofocus></label>
        <p v-if="existante" class="dr-note dr-note--info">Cette rubrique existe déjà : la liste montrera ses articles ici aussi (par exemple les 3 derniers sur l’accueil). Ses champs restent ceux de la rubrique.</p>
        <fieldset v-else class="dr-champs">
          <legend>Champs des articles <small>(le titre est toujours là)</small></legend>
          <label v-for="c in CHAMPS" :key="c.id" class="dr-coche">
            <input v-model="champs" type="checkbox" :value="c.id">
            <span>{{ c.libelle }} <small>{{ c.aide }}</small></span>
          </label>
        </fieldset>
      </template>
      <template v-else>
        <h2>🧵 Fil de plusieurs rubriques</h2>
        <p class="dr-note">Les articles des rubriques choisies, mélangés du plus récent au plus ancien. Il se met à jour tout seul ; le client n’a rien à faire.</p>
        <p v-if="!rubriques.length" class="dr-note dr-note--info">Le site n’a pas encore de rubrique. Posez d’abord un bloc « Rubrique ».</p>
        <fieldset v-else class="dr-champs">
          <legend>Rubriques à mélanger</legend>
          <label v-for="r in rubriques" :key="r.nom" class="dr-coche">
            <input v-model="choisies" type="checkbox" :value="r.nom"><span>{{ r.libelle }}</span>
          </label>
        </fieldset>
        <label>Titre de la section<input v-model="titreFil" required maxlength="120"></label>
      </template>

      <fieldset class="dr-champs">
        <legend>Articles affichés</legend>
        <label class="dr-coche"><input v-model="tous" type="radio" :value="true"><span>Tous</span></label>
        <label class="dr-coche dr-nombre"><input v-model="tous" type="radio" :value="false"><span>Les</span>
          <input v-model.number="nombre" type="number" min="1" max="100" aria-label="Nombre d’articles" @focus="tous = false"><span>derniers</span></label>
        <label v-if="mode === 'rubrique' && !tous && !existante" class="dr-coche dr-sous">
          <input v-model="pageComplete" type="checkbox"><span>Créer aussi une page « {{ libelle.trim() || 'Rubrique' }} » avec tous les articles, dans le menu</span>
        </label>
      </fieldset>

      <div class="dr-boutons">
        <button type="button" class="dr-btn dr-btn--clair" @click="emit('fermer')">Annuler</button>
        <button type="submit" class="dr-btn dr-btn--fort" :disabled="!valide || occupe">Ajouter la section</button>
      </div>
    </form>
  </div>
</template>

<style scoped>
.dr-fond { position: fixed; inset: 0; background: var(--bf-voile); backdrop-filter: blur(4px); display: grid; place-items: center; padding: 16px; z-index: 40; }
.dr { width: 100%; max-width: 480px; max-height: calc(100vh - 32px); overflow: auto; background: var(--bf-surface); backdrop-filter: blur(20px); border: 1px solid var(--bf-bord); border-radius: 20px; box-shadow: 0 30px 80px rgba(0, 0, 0, .5); padding: 24px; display: grid; gap: 14px; color: var(--bf-texte); }
.dr h2 { margin: 0; font-size: 20px; font-weight: 700; }
.dr label { display: grid; gap: 6px; font-size: 14px; font-weight: 600; }
.dr input:not([type="checkbox"]):not([type="radio"]) { background: var(--bf-champ); border: 1px solid var(--bf-bord-fort); border-radius: 10px; padding: 12px; color: var(--bf-texte); font: inherit; font-weight: 400; }
.dr-boutons { display: flex; justify-content: flex-end; gap: 8px; flex-wrap: wrap; }
.dr-btn { border: 0; border-radius: 999px; padding: 10px 16px; font: inherit; font-size: 14px; font-weight: 600; cursor: pointer; }
.dr-btn:disabled { opacity: .5; cursor: default; }
.dr-btn--clair { background: var(--bf-verre-fort); color: var(--bf-texte); box-shadow: inset 0 0 0 1px var(--bf-bord); }
.dr-btn--fort { background: var(--bf-degrade); color: #fff; box-shadow: 0 6px 18px rgba(139, 92, 246, .25); }
.dr-note { margin: 0; font-size: 13px; color: var(--bf-doux); line-height: 1.45; }
.dr-note--info { padding: 10px 12px; border-radius: 10px; background: rgba(139, 92, 246, .14); color: inherit; }
.dr-champs { display: grid; gap: 6px; margin: 0; padding: 0; border: 0; }
.dr-champs legend { margin-bottom: 6px; font-size: 13px; font-weight: 700; }
.dr-champs legend small { font-weight: 400; opacity: .7; }
.dr-coche { display: flex !important; flex-direction: row !important; align-items: center; gap: 8px; font-weight: 400 !important; cursor: pointer; }
.dr-coche input[type="checkbox"], .dr-coche input[type="radio"] { width: auto; margin: 0; accent-color: #8b5cf6; }
.dr-coche small { opacity: .65; font-size: 12px; }
.dr-nombre input[type="number"] { width: 64px; padding: 4px 8px; }
.dr-sous { padding-left: 24px; }
</style>
