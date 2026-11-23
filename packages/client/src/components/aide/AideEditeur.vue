<script setup lang="ts">
/**
 * Aide de l'éditeur pour les clients : six fiches courtes, et « Me montrer » qui désigne
 * le bouton concerné à l'écran. Le texte suit le rôle (un rédacteur ne publie pas).
 */
import { computed, ref } from 'vue'
import type { EtapeVisite } from './VisiteGuidee.vue'

const props = defineProps<{ responsable: boolean }>()
const emit = defineEmits<{ fermer: []; montrer: [etape: EtapeVisite]; visite: [] }>()

interface Fiche { id: string; icone: string; titre: string; etapes: string[]; montrer?: EtapeVisite }

// Sélecteurs des boutons de la barre (sur téléphone, ils sont dans le menu « ⋯ »)
const CIBLES = {
  apercu: ['[data-aide="apercu"]'],
  actualite: ['[data-aide="actualite"]'],
  publier: ['[data-aide="publier"]', '[data-aide="attente"]', '[data-aide="menu"]'],
  historique: ['[data-aide="historique"]', '[data-aide="menu"]'],
  espace: ['[data-aide="espace"]', '[data-aide="menu"]'],
  menu: ['[data-aide="menu"]', '[data-aide="aide"]'],
}

const fiches = computed<Fiche[]>(() => [
  {
    id: 'texte', icone: '✎', titre: 'Modifier un texte',
    etapes: [
      'Dans l’aperçu de votre site, cliquez sur le texte à changer.',
      'Tapez votre nouveau texte, puis cliquez ailleurs : c’est enregistré.',
      'Seuls les textes prévus pour vous sont modifiables : ils s’entourent quand on les survole.',
    ],
    montrer: { cibles: CIBLES.apercu, titre: 'Votre site', texte: 'Cliquez directement sur un texte de cet aperçu pour le modifier.' },
  },
  {
    id: 'photo', icone: '🖼️', titre: 'Changer une photo',
    etapes: [
      'Cliquez sur la photo dans l’aperçu.',
      'Choisissez une image sur votre ordinateur ou votre téléphone.',
      'Bifrost la met à la bonne taille tout seul : pas besoin de la retoucher avant.',
    ],
    montrer: { cibles: CIBLES.apercu, titre: 'Votre site', texte: 'Cliquez sur une photo de cet aperçu pour la remplacer.' },
  },
  {
    id: 'actualite', icone: '📰', titre: 'Ajouter une actualité',
    etapes: [
      'Cliquez sur « + Actualité ».',
      'Donnez un titre, une date, quelques lignes et des photos, puis « Créer l’actualité ».',
      'Pour déplacer ou supprimer une actualité, survolez-la dans l’aperçu.',
    ],
    montrer: { cibles: CIBLES.actualite, titre: '+ Actualité', texte: 'Ce bouton ouvre le formulaire d’une nouvelle actualité.' },
  },
  props.responsable
    ? {
        id: 'publier', icone: '🚀', titre: 'Publier, ou revenir en arrière',
        etapes: [
          'Vos changements restent en brouillon : les visiteurs ne les voient pas encore.',
          'Cliquez sur « Publier » pour les mettre en ligne.',
          'Une erreur ? L’horloge 🕘 montre les publications : « Revenir avant » annule la dernière.',
        ],
        montrer: { cibles: CIBLES.publier, titre: 'Publier', texte: 'Le chiffre indique combien de changements attendent. Un clic, et ils sont en ligne.' },
      }
    : {
        id: 'publier', icone: '🚀', titre: 'Quand mes changements sont-ils en ligne ?',
        etapes: [
          'Vos changements restent en brouillon : les visiteurs ne les voient pas encore.',
          'Un responsable du site les relit et les publie. Il est prévenu sur son téléphone.',
        ],
        montrer: { cibles: CIBLES.publier, titre: 'En attente', texte: 'Ici, vous voyez combien de changements attendent d’être publiés.' },
      },
  {
    id: 'messages', icone: '📨', titre: 'Lire les messages du site',
    etapes: [
      'Les messages du formulaire de contact arrivent par e-mail.',
      'Ils sont aussi dans « Mon espace » › Messages, avec un badge quand il y en a de nouveaux.',
      'Ils sont effacés au bout de 12 mois.',
    ],
    montrer: { cibles: CIBLES.espace, titre: 'Mon espace', texte: 'Vos messages, vos sites et votre compte sont ici.' },
  },
  {
    id: 'appli', icone: '📱', titre: 'Bifrost sur votre téléphone',
    etapes: [
      'Ouvrez Bifrost sur votre téléphone, puis le menu « ⋯ » › « Installer l’appli ».',
      'Bifrost s’ouvre ensuite comme une appli, depuis l’écran d’accueil.',
      'Dans « Mon espace » › Mon compte, activez les notifications pour être prévenu des messages.',
    ],
    montrer: { cibles: CIBLES.menu, titre: 'Menu', texte: 'Sur téléphone, « Installer l’appli » est dans ce menu.' },
  },
])

const ouverte = ref<string | null>('texte')
</script>

<template>
  <div class="ae-fond" @click.self="emit('fermer')">
    <section class="ae" role="dialog" aria-modal="true" aria-labelledby="ae-titre">
      <header class="ae-tete">
        <h2 id="ae-titre">Aide</h2>
        <button type="button" class="ae-fermer" aria-label="Fermer l’aide" @click="emit('fermer')">✕</button>
      </header>
      <ul class="ae-fiches">
        <li v-for="f in fiches" :key="f.id" :class="{ 'ae-ouverte': ouverte === f.id }">
          <button type="button" class="ae-titre" :aria-expanded="ouverte === f.id" @click="ouverte = ouverte === f.id ? null : f.id">
            <span class="ae-icone" aria-hidden="true">{{ f.icone }}</span>{{ f.titre }}
          </button>
          <div v-if="ouverte === f.id" class="ae-corps">
            <ol><li v-for="(e, n) in f.etapes" :key="n">{{ e }}</li></ol>
            <button v-if="f.montrer" type="button" class="ae-montrer" @click="emit('montrer', f.montrer)">Me montrer</button>
          </div>
        </li>
      </ul>
      <footer class="ae-pied">
        <button type="button" class="ae-lien" @click="emit('visite')">Revoir la visite guidée</button>
        <span>Une question ? Écrivez à la personne qui a créé votre site.</span>
      </footer>
    </section>
  </div>
</template>

<style scoped>
.ae-fond { position: fixed; inset: 0; z-index: 50; background: rgba(0, 0, 0, .35); display: flex; justify-content: flex-end; }
.ae { width: min(400px, 100%); height: 100%; overflow: auto; background: var(--bf-surface); backdrop-filter: blur(20px); border-left: 1px solid var(--bf-bord); color: var(--bf-texte); padding: 20px; display: flex; flex-direction: column; gap: 12px; box-shadow: -20px 0 60px rgba(0, 0, 0, .3); }
.ae-tete { display: flex; align-items: center; justify-content: space-between; }
.ae-tete h2 { margin: 0; font-size: 20px; }
.ae-fermer { background: var(--bf-verre); border: 0; border-radius: 999px; width: 36px; height: 36px; cursor: pointer; color: var(--bf-texte); font-size: 14px; }
.ae-fiches { list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; }
.ae-fiches > li { border-radius: 14px; background: var(--bf-verre); box-shadow: inset 0 0 0 1px var(--bf-bord); overflow: hidden; }
.ae-titre { width: 100%; display: flex; align-items: center; gap: 10px; padding: 12px 14px; background: none; border: 0; color: inherit; font: inherit; font-weight: 600; font-size: 15px; text-align: left; cursor: pointer; }
.ae-icone { width: 24px; text-align: center; }
.ae-corps { padding: 0 14px 14px 48px; font-size: 14px; line-height: 1.5; }
.ae-corps ol { margin: 0 0 10px; padding-left: 18px; display: grid; gap: 4px; }
.ae-montrer { border: 0; border-radius: 999px; padding: 6px 14px; font: inherit; font-size: 13px; font-weight: 600; cursor: pointer; background: var(--bf-degrade); color: #fff; }
.ae-pied { margin-top: auto; display: grid; gap: 6px; font-size: 13px; color: var(--bf-doux); padding-top: 8px; }
.ae-lien { justify-self: start; background: none; border: 0; padding: 0; color: var(--bf-texte); font: inherit; text-decoration: underline; cursor: pointer; }
@media (max-width: 640px) { .ae-corps { padding-left: 14px; } .ae-fond { align-items: flex-end; } .ae { height: auto; max-height: 85vh; border-left: 0; border-radius: 20px 20px 0 0; } }
</style>
