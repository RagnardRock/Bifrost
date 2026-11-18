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
      if (el.classList.contains('bf-edition')) return
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
    if (outils.contains(e.target)) return
    var el = e.target.closest && e.target.closest('[data-bf-element]')
    if (!el) return
    var info = listeDe(el)
    if (info && (!actif || actif.element !== info.element)) montrerOutils(info)
  })

  // ---------- position de défilement (rechargements après une modification) ----------
  var cleDefil = 'bf-defil-' + page
  try {
    var y = sessionStorage.getItem(cleDefil)
    if (y) { window.scrollTo(0, parseInt(y, 10)); sessionStorage.removeItem(cleDefil) }
  } catch (e) {}
  window.addEventListener('message', function (e) {
    if (!e.data || e.data.source !== 'bifrost-parent') return
    if (e.data.type === 'avant-rechargement') { try { sessionStorage.setItem(cleDefil, String(window.scrollY)) } catch (x) {} }
  })

  envoyer({ type: 'page', titre: document.title, modele: (document.querySelector('[data-bf-page]') || {}).getAttribute ? document.querySelector('[data-bf-page]').getAttribute('data-bf-page') : null })
})()
