/* Bifrost — édition sur place.
 * Chargé uniquement dans l'aperçu du brouillon (iframe de l'éditeur). Il rend les zones data-bf
 * modifiables et parle à l'éditeur parent par postMessage ; c'est le parent qui appelle l'API.
 */
(function () {
  'use strict'
  var page = (document.currentScript && document.currentScript.dataset.page) || 'index.html'
  var parent = window.parent
  if (parent === window) return

  function envoyer(msg) { msg.source = 'bifrost'; msg.page = page; parent.postMessage(msg, '*') }
  // mode dev (compte du développeur) : sélection de n'importe quel élément, réglé par l'éditeur parent
  var dev = false

  // ---------- styles ----------
  var css = document.createElement('style')
  css.textContent = [
    '[data-bf]:not([data-bf-element]), [data-bf][data-bf-element] { cursor: text; }',
    '.bf-survol { outline: 2px dashed #e07a4a !important; outline-offset: 3px; }',
    '.bf-edition { outline: 2px solid #e07a4a !important; outline-offset: 3px; background: rgba(224,122,74,.06); }',
    'img[data-bf] { cursor: pointer !important; }',
    '.bf-outils { position: absolute; z-index: 99999; display: flex; gap: 4px; padding: 4px; background: #1f2a24; border-radius: 999px; box-shadow: 0 6px 20px rgba(0,0,0,.3); font: 600 13px/1 system-ui, sans-serif; }',
    '.bf-outils button { all: unset; cursor: pointer; color: #fff; min-width: 30px; height: 30px; border-radius: 999px; display: grid; place-items: center; padding: 0 8px; }',
    '.bf-outils button:hover { background: #e07a4a; }',
    '.bf-outils .bf-danger:hover { background: #c0392b; }',
    '.bf-bulle { position: absolute; z-index: 99999; background: #1f2a24; color: #fff; font: 600 12px/1 system-ui, sans-serif; padding: 6px 10px; border-radius: 999px; pointer-events: none; white-space: nowrap; }',
  ].join('\n')
  document.head.appendChild(css)

  // ---------- repérage ----------
  function dansRiche(el) { var r = el.parentElement && el.parentElement.closest('[data-bf-type="riche"]'); return !!r }
  function listeDe(el) {
    var e = el.closest('[data-bf-element]')
    if (!e) return null
    var l = e.closest('[data-bf-liste]')
    if (!l || dansRiche(l)) return null
    var elements = Array.prototype.filter.call(l.querySelectorAll('[data-bf-element]'), function (x) { return x.closest('[data-bf-liste]') === l })
    return { nom: l.getAttribute('data-bf-liste'), index: elements.indexOf(e), element: e, liste: l, total: elements.length }
  }
  function typeDe(el) {
    var t = el.getAttribute('data-bf-type')
    if (t) return t
    if (el.tagName === 'IMG') return 'image'
    if (el.tagName === 'A') return 'lien'
    return 'texte'
  }
  function cibleTexte(el) {
    // un champ qui en contient d'autres (titre + résumé dans un <summary>) : on n'édite que son texte propre
    if (el.querySelector('[data-bf]')) {
      var propre = document.createElement('span')
      propre.className = 'bf-propre'
      Array.prototype.slice.call(el.childNodes).forEach(function (n) {
        if (n.nodeType === 3 && n.textContent.trim()) { if (!propre.parentNode) el.insertBefore(propre, n); propre.appendChild(n) }
      })
      if (!propre.parentNode) el.insertBefore(propre, el.firstChild)
      return propre
    }
    var enfants = el.children
    if (enfants.length === 1 && enfants[0].tagName === 'A' && el.textContent.trim() === enfants[0].textContent.trim()) return enfants[0]
    return el
  }
  function champ(el) {
    var l = listeDe(el)
    // un champ dans un élément de liste appartient à cet élément ; sinon c'est un champ de page
    return { cle: el.getAttribute('data-bf'), type: typeDe(el), liste: l ? l.nom : null, index: l ? l.index : null }
  }

  // les blocs repliables sont ouverts pendant la modification, pour que tout leur contenu soit accessible
  Array.prototype.forEach.call(document.querySelectorAll('details'), function (d) { d.open = true })

  var champs = Array.prototype.filter.call(document.querySelectorAll('[data-bf]'), function (el) { return !dansRiche(el) })

  // ---------- bulle d'aide ----------
  var bulle = document.createElement('div')
  bulle.className = 'bf-bulle'
  bulle.hidden = true
  bulle.setAttribute('data-bf-overlay', '')
  document.body.appendChild(bulle)
  function montrerBulle(el, texte) {
    var r = el.getBoundingClientRect()
    bulle.textContent = texte
    bulle.hidden = false
    bulle.style.left = (window.scrollX + r.left) + 'px'
    bulle.style.top = (window.scrollY + Math.max(0, r.top - 30)) + 'px'
  }

  champs.forEach(function (el) {
    el.addEventListener('mouseenter', function () {
      if (dev || el.classList.contains('bf-edition')) return
      el.classList.add('bf-survol')
      montrerBulle(el, typeDe(el) === 'image' ? 'Cliquer pour changer la photo' : 'Cliquer pour modifier')
    })
    el.addEventListener('mouseleave', function () { el.classList.remove('bf-survol'); bulle.hidden = true })
  })

  // ---------- textes ----------
  var enCours = null
  function commencer(el) {
    if (enCours === el) return
    if (enCours) terminer(enCours)
    var t = typeDe(el)
    var cible = t === 'riche' ? el : cibleTexte(el)
    el.classList.remove('bf-survol')
    el.classList.add('bf-edition')
    bulle.hidden = true
    cible.setAttribute('contenteditable', t === 'riche' ? 'true' : 'plaintext-only')
    if (cible.contentEditable !== 'plaintext-only' && t !== 'riche') cible.setAttribute('contenteditable', 'true')
    el._bfCible = cible
    el._bfAvant = t === 'riche' ? el.innerHTML : cible.textContent
    cible.focus()
    enCours = el
  }
  function terminer(el) {
    var t = typeDe(el)
    var cible = el._bfCible || el
    cible.removeAttribute('contenteditable')
    el.classList.remove('bf-edition')
    enCours = null
    var valeur = t === 'riche' ? el.innerHTML : cible.textContent.replace(/\s+/g, ' ').trim()
    if (cible.className === 'bf-propre') cible.replaceWith(document.createTextNode(cible.textContent))
    if (valeur === (t === 'riche' ? el._bfAvant : (el._bfAvant || '').replace(/\s+/g, ' ').trim())) return
    var c = champ(el)
    c.type = 'champ'
    c.valeur = valeur
    envoyer(c)
  }

  document.addEventListener('click', function (e) {
    if (dev) { devClic(e); return }
    var el = e.target.closest && e.target.closest('[data-bf]')
    while (el && dansRiche(el)) el = el.parentElement.closest('[data-bf]')
    if (el) {
      e.preventDefault()
      e.stopPropagation()
      if (typeDe(el) === 'image') { var c = champ(el); c.type = 'image'; envoyer(c); return }
      commencer(el)
      return
    }
    if (enCours && !enCours.contains(e.target)) terminer(enCours)
    // liens : on reste dans l'aperçu pour les pages du site, on bloque les autres
    var a = e.target.closest && e.target.closest('a[href]')
    if (a) {
      var href = a.getAttribute('href')
      if (/^(https?:|mailto:|tel:)/i.test(href)) { e.preventDefault(); envoyer({ type: 'info', texte: 'Les liens externes sont désactivés pendant la modification.' }) }
    }
    // les boutons « Envoyer » des formulaires ne doivent rien envoyer pendant l'édition
    if (e.target.closest && e.target.closest('form button, form [type=submit]')) {
      e.preventDefault()
      if (e.target.closest('form[data-bf-formulaire]')) envoyer({ type: 'info', texte: 'Le formulaire marche sur le site en ligne. Les messages arrivent dans 📨 Messages.' })
    }
  }, true)

  // aucun formulaire ne part pendant l'édition (touche Entrée dans un champ, par exemple)
  document.addEventListener('submit', function (e) { e.preventDefault() }, true)

  document.addEventListener('keydown', function (e) {
    if (dev) { devTouche(e); return }
    if (!enCours) return
    if (e.key === 'Escape') { var c = enCours._bfCible || enCours; if (typeDe(enCours) === 'riche') enCours.innerHTML = enCours._bfAvant; else c.textContent = enCours._bfAvant; terminer(enCours) }
    else if (e.key === 'Enter' && typeDe(enCours) !== 'riche') { e.preventDefault(); terminer(enCours) }
  })
  document.addEventListener('focusout', function (e) {
    if (enCours && (e.target === enCours || e.target === enCours._bfCible)) setTimeout(function () { if (enCours && !enCours.contains(document.activeElement)) terminer(enCours) }, 0)
  })
  // collage : texte brut seulement dans les champs simples
  document.addEventListener('paste', function (e) {
    if (!enCours || typeDe(enCours) === 'riche') return
    e.preventDefault()
    var t = (e.clipboardData || window.clipboardData).getData('text/plain').replace(/\s+/g, ' ')
    document.execCommand('insertText', false, t)
  })

  // ---------- éléments de liste ----------
  var outils = document.createElement('div')
  outils.className = 'bf-outils'
  outils.hidden = true
  outils.setAttribute('data-bf-overlay', '')
  document.body.appendChild(outils)
  var actif = null
  function bouton(texte, titre, fn, danger) {
    var b = document.createElement('button')
    b.type = 'button'; b.textContent = texte; b.title = titre; b.setAttribute('aria-label', titre)
    if (danger) b.className = 'bf-danger'
    b.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); fn() })
    outils.appendChild(b)
  }
  function montrerOutils(info) {
    actif = info
    outils.innerHTML = ''
    var op = function (nom, extra) { return function () { var m = { type: 'liste', nom: info.nom, index: info.index, op: nom }; for (var k in extra) m[k] = extra[k]; envoyer(m) } }
    if (info.index > 0) bouton('↑', 'Monter', op('deplacer', { vers: info.index - 1 }))
    if (info.index < info.total - 1) bouton('↓', 'Descendre', op('deplacer', { vers: info.index + 1 }))
    bouton('⧉', 'Dupliquer', op('dupliquer'))
    var lien = info.element.querySelector('a[href]')
    if (lien && !/^(https?:|mailto:|tel:)/i.test(lien.getAttribute('href'))) bouton('Ouvrir', 'Ouvrir la page', function () { window.location.href = lien.href })
    bouton('✕', 'Supprimer', function () { envoyer({ type: 'liste', nom: info.nom, index: info.index, op: 'supprimer', demanderConfirmation: true }) }, true)
    var r = info.element.getBoundingClientRect()
    outils.hidden = false
    var largeur = outils.offsetWidth
    outils.style.left = (window.scrollX + Math.max(4, r.right - largeur - 6)) + 'px'
    outils.style.top = (window.scrollY + r.top + 6) + 'px'
  }
  document.addEventListener('mouseover', function (e) {
    if (dev) { devSurvol(e); return }
    if (outils.contains(e.target)) return
    var el = e.target.closest && e.target.closest('[data-bf-element]')
    if (!el) return
    var info = listeDe(el)
    if (info && (!actif || actif.element !== info.element)) montrerOutils(info)
  })

  // ---------- mode dev ----------
  // Le dev sélectionne n'importe quel élément ; l'éditeur parent affiche le panneau « Élément »
  // et appelle l'API. Un élément est désigné par son chemin depuis <body> (indice parmi les enfants).
  var cssDev = document.createElement('style')
  cssDev.textContent = [
    '.bf-dev-survol { outline: 1px dashed rgba(139,92,246,.9) !important; outline-offset: 1px; cursor: default !important; }',
    '.bf-dev-choisi { outline: 2px solid #8b5cf6 !important; outline-offset: 2px; }',
    '.bf-dev-flag { box-shadow: inset 0 0 0 1px rgba(224,122,74,.55) !important; }',
    '.bf-dev-etiquette { position: absolute; z-index: 99999; pointer-events: none; background: #8b5cf6; color: #fff; font: 600 11px/1 ui-monospace, Consolas, monospace; padding: 4px 7px; border-radius: 6px; white-space: nowrap; max-width: 90vw; overflow: hidden; text-overflow: ellipsis; }',
    '.bf-dev-edition { outline: 2px solid #e07a4a !important; cursor: text !important; }',
  ].join('\n')
  var etiquette = document.createElement('div')
  etiquette.className = 'bf-dev-etiquette'
  etiquette.hidden = true
  etiquette.setAttribute('data-bf-overlay', '')
  document.body.appendChild(etiquette)
  var choisi = null
  var survole = null
  var devEdition = null

  function estOverlay(el) { return !el || el.nodeType !== 1 || el.hasAttribute('data-bf-overlay') || el.tagName === 'SCRIPT' && el.src && /\/editeur\/overlay\.js/.test(el.src) }
  function selectionnable(el) {
    if (!el || el.nodeType !== 1 || el === document.body || el === document.documentElement) return null
    while (el && el !== document.body && !document.body.contains(el)) el = el.parentElement
    if (!el || el === document.body) return null
    for (var x = el; x && x !== document.body; x = x.parentElement) if (estOverlay(x)) return null
    // la pastille provisoire de l'édition client ne compte pas
    if (el.classList.contains('bf-propre')) el = el.parentElement
    return el
  }
  function cheminDe(el) {
    var chemin = [], balises = []
    for (var x = el; x && x !== document.body; x = x.parentElement) {
      chemin.unshift(Array.prototype.indexOf.call(x.parentElement.children, x))
      balises.unshift(x.tagName.toLowerCase())
    }
    return { chemin: chemin, balises: balises }
  }
  function depuisChemin(chemin) {
    var el = document.body
    for (var i = 0; i < chemin.length; i++) { el = el && el.children[chemin[i]]; if (!el) return null }
    return el === document.body ? null : el
  }
  function libelle(el) {
    var t = el.tagName.toLowerCase()
    if (el.id) t += '#' + el.id
    else if (typeof el.className === 'string' && el.className.trim()) t += '.' + el.className.trim().split(/\s+/).filter(function (c) { return !/^bf-/.test(c) })[0]
    return t.replace(/\.$/, '').replace(/\.undefined$/, '')
  }
  function flagsDe(el) {
    var f = {}
    ;['data-bf', 'data-bf-type', 'data-bf-liste', 'data-bf-limite', 'data-bf-page', 'data-bf-formulaire'].forEach(function (a) { if (el.hasAttribute(a)) f[a] = el.getAttribute(a) })
    if (el.hasAttribute('data-bf-element')) f['data-bf-element'] = true
    return f
  }
  function nomPage() { var n = page.replace(/\.html$/, '').split('/').pop(); return n === 'index' ? 'accueil' : n.replace(/[^\w-]/g, '') || 'page' }
  function nomBalise(el) {
    var t = el.tagName.toLowerCase()
    if (/^h[1-6]$/.test(t)) return 'titre'
    return ({ p: 'texte', img: 'photo', a: 'lien', li: 'element', time: 'date', figcaption: 'legende', blockquote: 'citation', button: 'bouton', span: 'texte', small: 'note', strong: 'texte', address: 'adresse' })[t] || t
  }
  function slug(t) {
    return (t || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
      .split(' ').filter(function (m) { return m.length > 2 && !/^(une|des|les|pour|avec|dans|nos|notre|votre|vos|aux|sur|par|qui|que|est|son|ses|leur|leurs|chez|entre|tout|tous)$/.test(m) }).slice(0, 2).join('-')
  }
  /** Préfixe d'une clé hors liste : l'id de la zone, sinon les premiers mots de son titre, sinon le nom de la page. */
  function prefixeDe(el) {
    var zone = el.parentElement && el.parentElement.closest('section, article, header, footer, nav, aside, [id]')
    while (zone && zone !== document.body && (zone.tagName === 'MAIN' || /^(contenu|content|main|page)$/i.test(zone.id || ''))) zone = zone.parentElement.closest('section, article, header, footer, nav, aside, [id]')
    if (!zone || zone === document.body) return nomPage()
    if (zone.id) return zone.id.replace(/[^\w-]/g, '')
    if (/^(HEADER|FOOTER|NAV)$/.test(zone.tagName)) return ({ HEADER: 'entete', FOOTER: 'pied', NAV: 'menu' })[zone.tagName]
    var titre = zone.querySelector('h1, h2, h3')
    return slug(titre && titre !== el ? titre.textContent : titre ? titre.textContent : '') || nomPage()
  }
  /** Clé proposée : « section.titre » hors liste, « titre » dans un élément de liste ; unique dans sa portée. */
  function suggestion(el) {
    var element = el.parentElement && el.parentElement.closest('[data-bf-element]')
    var base = nomBalise(el)
    var cle = base
    if (!element) cle = prefixeDe(el) + '.' + base
    var portee = element || document
    var prises = {}
    Array.prototype.forEach.call(portee.querySelectorAll('[data-bf]'), function (x) {
      if (x === el) return
      if (!element && x.closest('[data-bf-element]')) return
      prises[x.getAttribute('data-bf')] = true
    })
    var c = cle, n = 2
    while (prises[c]) c = cle + '-' + (n++)
    var type = el.tagName === 'IMG' ? 'image' : el.tagName === 'A' ? 'lien' : el.querySelector('p, br, strong, em, ul, ol, b, i') ? 'riche' : 'texte'
    return { cle: c, type: type }
  }
  function infos(el) {
    var c = cheminDe(el)
    var fil = []
    for (var x = el; x && x !== document.body; x = x.parentElement) fil.unshift(libelle(x))
    var liste = el.closest('[data-bf-liste]')
    var element = el.parentElement && el.parentElement.closest('[data-bf-element]')
    var attributs = {}
    ;['alt', 'href', 'title', 'src'].forEach(function (a) { if (el.hasAttribute(a)) attributs[a] = el.getAttribute(a) })
    var feuille = !el.children.length
    return {
      type: 'selection',
      chemin: c.chemin, balises: c.balises, fil: fil,
      balise: el.tagName.toLowerCase(),
      feuille: feuille && !/^(img|input|br|hr|iframe|video|svg)$/i.test(el.tagName),
      texte: feuille ? (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 5000) : '',
      flags: flagsDe(el),
      attributs: attributs,
      contexte: {
        liste: liste && liste !== el ? liste.getAttribute('data-bf-liste') : null,
        dansElement: !!element,
        dansRiche: !!(el.parentElement && el.parentElement.closest('[data-bf-type="riche"]')),
      },
      suggestion: suggestion(el),
      peutMonter: !!el.previousElementSibling,
      peutDescendre: !!(el.nextElementSibling && !estOverlay(el.nextElementSibling) && el.nextElementSibling.tagName !== 'SCRIPT'),
    }
  }
  function placerEtiquette(el) {
    var r = el.getBoundingClientRect()
    var f = el.getAttribute('data-bf') || el.getAttribute('data-bf-liste')
    etiquette.textContent = libelle(el) + (f ? '  ·  ' + f : '')
    etiquette.hidden = false
    etiquette.style.left = (window.scrollX + Math.max(2, r.left)) + 'px'
    etiquette.style.top = (window.scrollY + (r.top > 24 ? r.top - 22 : r.bottom + 4)) + 'px'
  }
  function choisir(el, defiler) {
    if (choisi) choisi.classList.remove('bf-dev-choisi')
    choisi = el
    el.classList.add('bf-dev-choisi')
    if (defiler) el.scrollIntoView({ block: 'center', behavior: 'smooth' })
    placerEtiquette(el)
    envoyer(infos(el))
  }
  function deselectionner() {
    if (choisi) choisi.classList.remove('bf-dev-choisi')
    choisi = null
    etiquette.hidden = true
    envoyer({ type: 'selection', chemin: null })
  }
  function devSurvol(e) {
    var el = selectionnable(e.target)
    if (el === survole) return
    if (survole) survole.classList.remove('bf-dev-survol')
    survole = el
    if (el && el !== choisi) el.classList.add('bf-dev-survol')
  }
  function devClic(e) {
    if (devEdition && devEdition.contains(e.target)) return
    e.preventDefault()
    e.stopPropagation()
    if (devEdition) finirEditionDev(true)
    var el = selectionnable(e.target)
    if (el) choisir(el); else deselectionner()
  }
  function commencerEditionDev(el) {
    if (!el || el.children.length || /^(IMG|INPUT|BR|HR|IFRAME|VIDEO)$/.test(el.tagName)) return
    devEdition = el
    el._bfAvant = el.textContent
    el.classList.add('bf-dev-edition')
    el.setAttribute('contenteditable', 'plaintext-only')
    if (el.contentEditable !== 'plaintext-only') el.setAttribute('contenteditable', 'true')
    el.focus()
  }
  function finirEditionDev(garder) {
    var el = devEdition
    if (!el) return
    devEdition = null
    el.removeAttribute('contenteditable')
    el.classList.remove('bf-dev-edition')
    var v = (el.textContent || '').replace(/\s+/g, ' ').trim()
    if (!garder) { el.textContent = el._bfAvant; return }
    if (v === (el._bfAvant || '').replace(/\s+/g, ' ').trim()) return
    var c = cheminDe(el)
    envoyer({ type: 'dev', chemin: c.chemin, balises: c.balises, operation: { op: 'texte', valeur: v } })
  }
  function devTouche(e) {
    if (devEdition) {
      if (e.key === 'Escape') { e.preventDefault(); finirEditionDev(false) }
      else if (e.key === 'Enter') { e.preventDefault(); finirEditionDev(true) }
      return
    }
    if (!choisi) return
    if (e.key === 'Escape') {
      e.preventDefault()
      var p = choisi.parentElement
      if (p && p !== document.body) choisir(p); else deselectionner()
    } else if (e.key === 'Enter') { e.preventDefault(); commencerEditionDev(choisi) }
    else if (e.key === 'Delete') { e.preventDefault(); var c = cheminDe(choisi); envoyer({ type: 'dev', chemin: c.chemin, balises: c.balises, operation: { op: 'supprimer' }, demanderConfirmation: true }) }
  }
  document.addEventListener('dblclick', function (e) {
    if (!dev) return
    e.preventDefault()
    var el = selectionnable(e.target)
    if (el) { choisir(el); commencerEditionDev(el) }
  }, true)
  document.addEventListener('focusout', function (e) {
    if (dev && devEdition && e.target === devEdition) setTimeout(function () { if (devEdition && document.activeElement !== devEdition) finirEditionDev(true) }, 0)
  })

  /** Tous les flags de la page, avec les problèmes repérés, pour la vue « Flags de la page ». */
  function inventaire() {
    var res = [], alertes = []
    var vus = {}
    Array.prototype.forEach.call(document.querySelectorAll('[data-bf], [data-bf-liste], [data-bf-element], [data-bf-page], [data-bf-formulaire]'), function (el) {
      if (!selectionnable(el)) return
      var c = cheminDe(el)
      var f = flagsDe(el)
      var dansRiche = !!(el.parentElement && el.parentElement.closest('[data-bf-type="riche"]'))
      var element = el.parentElement && el.parentElement.closest('[data-bf-element]')
      res.push({ chemin: c.chemin, balise: el.tagName.toLowerCase(), flags: f, profondeur: c.chemin.length, ignore: dansRiche })
      var probleme = function (texte) { alertes.push({ chemin: c.chemin, texte: texte }) }
      if (dansRiche) probleme('« ' + (f['data-bf'] || f['data-bf-liste']) + ' » est dans un texte riche : il est ignoré.')
      if (f['data-bf-element'] && !el.closest('[data-bf-liste]')) probleme('Élément de liste en dehors de toute liste.')
      if (f['data-bf-liste'] && !Array.prototype.some.call(el.querySelectorAll('[data-bf-element]'), function (x) { return x.parentElement.closest('[data-bf-liste]') === el })) probleme('La liste « ' + f['data-bf-liste'] + ' » n’a aucun élément (data-bf-element).')
      if (f['data-bf'] !== undefined) {
        if (!f['data-bf']) probleme('Flag sans nom.')
        else if (!element && !dansRiche) {
          var v = el.tagName === 'IMG' ? el.getAttribute('src') : (el.textContent || '').replace(/\s+/g, ' ').trim()
          if (vus[f['data-bf']] !== undefined && vus[f['data-bf']] !== v) probleme('« ' + f['data-bf'] + ' » apparaît plusieurs fois avec des contenus différents : modifier l’un écrasera les autres.')
          vus[f['data-bf']] = v
        }
        if (el.tagName === 'IMG' && !el.hasAttribute('alt')) probleme('Image « ' + f['data-bf'] + ' » sans texte alternatif (alt).')
      }
    })
    Array.prototype.forEach.call(document.querySelectorAll('img:not([alt])'), function (el) {
      if (!selectionnable(el) || el.hasAttribute('data-bf')) return
      alertes.push({ chemin: cheminDe(el).chemin, texte: 'Image sans attribut alt.' })
    })
    envoyer({ type: 'flags-page', flags: res, alertes: alertes })
  }

  function basculerDev(actif) {
    if (actif === dev) { if (dev) inventaire(); return }
    dev = actif
    if (enCours) terminer(enCours)
    outils.hidden = true
    bulle.hidden = true
    if (dev) {
      document.head.appendChild(cssDev)
      Array.prototype.forEach.call(document.querySelectorAll('[data-bf], [data-bf-liste]'), function (el) { el.classList.add('bf-dev-flag') })
      inventaire()
    } else {
      if (cssDev.parentNode) cssDev.parentNode.removeChild(cssDev)
      Array.prototype.forEach.call(document.querySelectorAll('.bf-dev-flag, .bf-dev-survol, .bf-dev-choisi'), function (el) { el.classList.remove('bf-dev-flag', 'bf-dev-survol', 'bf-dev-choisi') })
      if (devEdition) finirEditionDev(false)
      choisi = null
      etiquette.hidden = true
    }
  }
  window.addEventListener('scroll', function () { if (dev && choisi) placerEtiquette(choisi) }, { passive: true })

  // ---------- position de défilement (rechargements après une modification) ----------
  var cleDefil = 'bf-defil-' + page
  try {
    var y = sessionStorage.getItem(cleDefil)
    if (y) { window.scrollTo(0, parseInt(y, 10)); sessionStorage.removeItem(cleDefil) }
  } catch (e) {}
  window.addEventListener('message', function (e) {
    if (!e.data || e.data.source !== 'bifrost-parent') return
    if (e.data.type === 'avant-rechargement') { try { sessionStorage.setItem(cleDefil, String(window.scrollY)) } catch (x) {} }
    else if (e.data.type === 'mode') basculerDev(!!e.data.dev)
    else if (e.data.type === 'selectionner' && dev) { var el = depuisChemin(e.data.chemin || []); if (el) choisir(el, !!e.data.defiler); else deselectionner() }
  })

  envoyer({ type: 'page', titre: document.title, modele: (document.querySelector('[data-bf-page]') || {}).getAttribute ? document.querySelector('[data-bf-page]').getAttribute('data-bf-page') : null })
})()
