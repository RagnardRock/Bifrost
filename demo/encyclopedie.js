/**
 * Encyclopedie Demo - JavaScript
 * Gestion du slider de niveau et affichage du contenu adaptatif
 */

(function() {
  'use strict';

  // Configuration
  const API_URL = 'http://localhost:3000/api';
  let apiKey = null;
  let collectionBlocks = [];

  // Contenu par defaut (fallback si pas de donnees Bifrost)
  const defaultContent = {
    intro: {
      1: "<p>Blablablablablablablablablablablablablabla</p>",
      3: "<p>Blablablablablablablablablablablablablabla.Blablablablablablablablablablablablablabla</p>"
    },
    definition: {
      1: "<p>Blablablablablablablablablablablablablabla</p>",
      2: "<p>Blablablablablablablablablablablablablabla.Blablablablablablablablablablablablablabla</p>"
    },
    structure: {
      2: "<p>Blablablablablablablablablablablablablabla.Blablablablablablablablablablablablablabla</p>"
    },
    details: {
      3: "<p>Blablablablablablablablablablablablablabla.Blablablablablablablablablablablablablabla</p>"
    },
    formulas: {
      4: "<p>Blablablablablablablablablablablablablabla.Blablablablablablablablablablablablablabla</p>"
    }
  };

  // Elements DOM
  let slider, levelValue, levelIndicators;

  // Couleurs par niveau
  const levelColors = {
    1: 'text-green-500',
    2: 'text-yellow-500',
    3: 'text-orange-500',
    4: 'text-red-500'
  };

  // Mettre a jour l'affichage du niveau
  function updateLevelDisplay(level) {
    levelValue.textContent = level;
    levelValue.className = `text-lg font-bold w-8 ${levelColors[level]}`;

    levelIndicators.forEach(indicator => {
      const indicatorLevel = parseInt(indicator.dataset.level);
      indicator.classList.toggle('active', indicatorLevel === level);
      indicator.style.opacity = indicatorLevel <= level ? '1' : '0.4';
    });
  }

  // Afficher/masquer les sections selon le niveau minimum
  function updateSectionVisibility(level) {
    document.querySelectorAll('[data-min-level]').forEach(section => {
      const minLevel = parseInt(section.dataset.minLevel);
      section.style.display = level >= minLevel ? 'block' : 'none';
    });
  }

  // Mettre a jour le contenu selon le niveau
  function updateContent(level) {
    const sections = ['intro', 'definition', 'structure', 'details', 'formulas'];

    sections.forEach(sectionName => {
      const el = document.querySelector(`[data-section="${sectionName}"]`);
      if (!el) return;

      // Chercher dans les blocs Bifrost
      let content = null;
      let blocksForSection = collectionBlocks
        .filter(b => b.data.section === sectionName && b.data.level <= level)
        .sort((a, b) => a.data.level - b.data.level);

      if (blocksForSection.length > 0) {
        // Appliquer la logique show/replace
        content = '';
        blocksForSection.forEach(block => {
          if (block.data.mode === 'replace') {
            content = block.data.content;
          } else {
            content += block.data.content;
          }
        });
      } else {
        // Fallback: contenu par defaut
        const defaults = defaultContent[sectionName];
        if (defaults) {
          const levels = Object.keys(defaults).map(Number).sort((a, b) => a - b);
          for (const l of levels) {
            if (l <= level) {
              content = defaults[l];
            }
          }
        }
      }

      if (content) {
        el.innerHTML = content;
      }
    });
  }

  // Initialisation
  function init() {
    // Recuperer les elements DOM
    slider = document.getElementById('level-slider');
    levelValue = document.getElementById('level-value');
    levelIndicators = document.querySelectorAll('.level-indicator');

    if (!slider || !levelValue) {
      console.error('[Encyclopedie] Elements DOM manquants');
      return;
    }

    // Recuperer la cle API
    const urlParams = new URLSearchParams(window.location.search);
    apiKey = urlParams.get('key') || localStorage.getItem('bifrost_demo_key');

    if (!apiKey) {
      apiKey = prompt('Entrez votre cle API Bifrost:');
      if (apiKey) localStorage.setItem('bifrost_demo_key', apiKey);
    }

    // Initialiser l'affichage avec contenu par defaut
    const initialLevel = 1;
    updateLevelDisplay(initialLevel);
    updateSectionVisibility(initialLevel);
    updateContent(initialLevel);

    // Ecouteur du slider
    slider.addEventListener('input', (e) => {
      const level = parseInt(e.target.value);
      updateLevelDisplay(level);
      updateSectionVisibility(level);
      updateContent(level);
    });

    // Charger le loader Bifrost
    if (apiKey) {
      loadBifrost();
    }
  }

  // Charger Bifrost
  function loadBifrost() {
    const urlParams = new URLSearchParams(window.location.search);

    const script = document.createElement('script');
    script.src = '/loader.js';
    script.setAttribute('data-site', apiKey);
    document.body.appendChild(script);

    // Ecouter quand les collections sont chargees par Bifrost
    window.addEventListener('bifrost:collections-loaded', (e) => {
      console.log('[Encyclopedie] Collections recues de Bifrost:', e.detail);
      if (e.detail.blocks) {
        collectionBlocks = e.detail.blocks;
        console.log('[Encyclopedie] Blocs charges:', collectionBlocks.length);
        // Mettre a jour le contenu avec les nouvelles donnees
        updateContent(parseInt(slider.value));
      }
    });
  }

  // Run when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
