# Guide d'integration Bifrost CMS

Ce guide explique comment rendre un site web editable avec Bifrost CMS.

## Table des matieres

1. [Prerequis](#prerequis)
2. [Integration rapide](#integration-rapide)
3. [Marquer les elements editables](#marquer-les-elements-editables)
4. [Types de contenus](#types-de-contenus)
5. [Collections (listes)](#collections-listes)
6. [Creer le schema](#creer-le-schema)
7. [Mode edition](#mode-edition)
8. [Exemples complets](#exemples-complets)

---

## Prerequis

- Un site Bifrost fonctionnel (auto-heberge ou cloud)
- Un site cree dans l'admin Bifrost avec sa cle API
- Acces au code HTML de votre site

---

## Integration rapide

### Etape 1 : Ajouter le script loader

Ajoutez cette ligne avant la fermeture de `</body>` :

```html
<script src="https://votre-bifrost.com/loader.js" data-site="VOTRE_CLE_API"></script>
```

Remplacez :
- `votre-bifrost.com` par l'URL de votre serveur Bifrost
- `VOTRE_CLE_API` par la cle API du site (visible dans l'admin Bifrost)

### Etape 2 : Marquer les elements editables

Ajoutez l'attribut `data-bifrost="nom-du-champ"` sur les elements a rendre editables :

```html
<h1 data-bifrost="titre">Mon titre par defaut</h1>
<p data-bifrost="description">Ma description par defaut</p>
```

### Etape 3 : Activer le mode edition

Accedez a votre site avec `?edit=true` dans l'URL :

```
https://monsite.com?edit=true
```

Un bouton "Editer" apparaitra. Connectez-vous avec vos identifiants Bifrost.

---

## Marquer les elements editables

### Syntaxe de base

```html
<element data-bifrost="cle-unique">Contenu par defaut</element>
```

- **cle-unique** : Identifiant unique du champ (ex: `hero-title`, `about.description`)
- **Contenu par defaut** : S'affiche si aucune valeur n'est sauvegardee

### Conventions de nommage

Utilisez des points pour organiser vos champs par section :

```html
<!-- Section Hero -->
<h1 data-bifrost="hero.title">Titre</h1>
<p data-bifrost="hero.subtitle">Sous-titre</p>

<!-- Section About -->
<h2 data-bifrost="about.title">A propos</h2>
<p data-bifrost="about.description">Description</p>

<!-- Section Contact -->
<span data-bifrost="contact.email">email@example.com</span>
<span data-bifrost="contact.phone">01 23 45 67 89</span>
```

---

## Types de contenus

### Texte simple

Pour les titres, boutons, labels :

```html
<h1 data-bifrost="hero.title">Bienvenue</h1>
<button data-bifrost="hero.cta">Contactez-nous</button>
<span data-bifrost="footer.copyright">2024 MonSite</span>
```

### Images

Pour les images, Bifrost detecte automatiquement la balise `<img>` :

```html
<img
  data-bifrost="hero.logo"
  src="images/logo-defaut.png"
  alt="Logo"
/>

<img
  data-bifrost="about.photo"
  src="images/photo-defaut.jpg"
  alt="Photo equipe"
/>
```

En mode edition, un panneau d'upload apparait avec :
- Upload par clic ou drag & drop
- Preview de l'image
- Stockage automatique sur Cloudinary

### Texte riche (HTML)

Pour les contenus avec mise en forme (gras, italique, liens) :

```html
<div data-bifrost="about.description">
  <p>Notre entreprise est <strong>leader</strong> dans son domaine.</p>
  <p>Decouvrez nos <a href="/services">services</a>.</p>
</div>
```

Le type `richtext` doit etre declare dans le schema pour activer l'editeur avec toolbar.

---

## Collections (listes)

Les collections permettent de gerer des listes d'elements (temoignages, articles, equipe, etc.).

### Structure HTML

```html
<div
  data-bifrost-collection="testimonials"
  data-bifrost-template="tpl-testimonial"
>
  <!-- Template (invisible, utilise pour generer les items) -->
  <template id="tpl-testimonial">
    <div class="testimonial">
      <p data-field="quote">"Citation ici"</p>
      <strong data-field="name">Nom</strong>
      <span data-field="role">Poste</span>
    </div>
  </template>

  <!-- Contenu par defaut (remplace par les donnees Bifrost) -->
  <div class="testimonial">
    <p>"Super service !"</p>
    <strong>Marie Dupont</strong>
    <span>CEO, TechCorp</span>
  </div>
</div>
```

### Attributs

| Attribut | Description |
|----------|-------------|
| `data-bifrost-collection="type"` | Identifiant de la collection |
| `data-bifrost-template="id"` | ID du template a utiliser |
| `data-field="champ"` | Champ de l'item (dans le template) |

### Exemple : Liste d'equipe

```html
<section class="team">
  <h2>Notre equipe</h2>

  <div
    data-bifrost-collection="team"
    data-bifrost-template="tpl-member"
    class="team-grid"
  >
    <template id="tpl-member">
      <div class="member-card">
        <img data-field="photo" src="" alt="Photo">
        <h3 data-field="name">Nom</h3>
        <p data-field="role">Poste</p>
        <p data-field="bio">Bio</p>
      </div>
    </template>

    <!-- Fallback -->
    <div class="member-card">
      <img src="placeholder.jpg" alt="Photo">
      <h3>Jean Martin</h3>
      <p>Developpeur</p>
    </div>
  </div>
</section>
```

---

## Creer le schema

Le schema definit les champs editables et leurs types. Il se configure dans l'admin Bifrost (Site > Modifier le schema).

### Structure YAML

```yaml
fields:
  hero.title:
    type: text
    label: "Titre principal"

  hero.subtitle:
    type: text
    label: "Sous-titre"

  hero.logo:
    type: image
    label: "Logo"

  about.description:
    type: richtext
    label: "Description"

  contact.email:
    type: text
    label: "Email"

collections:
  testimonials:
    label: "Temoignages"
    fields:
      quote:
        type: text
        label: "Citation"
      name:
        type: text
        label: "Nom"
      role:
        type: text
        label: "Poste"
```

### Types disponibles

| Type | Description | Utilisation |
|------|-------------|-------------|
| `text` | Texte court | Titres, boutons, labels |
| `richtext` | Texte avec formatage HTML | Paragraphes, descriptions |
| `image` | URL d'image | Photos, logos, icones |
| `number` | Nombre | Prix, quantites |
| `boolean` | Vrai/Faux | Options on/off |
| `date` | Date | Dates d'evenements |

---

## Mode edition

### Activer le mode edition

Ajoutez `?edit=true` a l'URL de votre site :

```
https://monsite.com?edit=true
https://monsite.com/about?edit=true
https://monsite.com/contact?edit=true
```

### Workflow d'edition

1. Accedez au site avec `?edit=true`
2. Cliquez sur "Editer" dans le bouton flottant
3. Connectez-vous avec vos identifiants Bifrost
4. Cliquez sur un element pour l'editer
5. Modifiez et cliquez "Enregistrer"
6. Cliquez "Terminer" quand vous avez fini

### Indicateurs visuels

- **Bordure violette pointillee** : Element survolable (editable)
- **Bordure verte** : Element en cours d'edition
- **Bordure orange** : Collection editable

---

## Exemples complets

### Site vitrine simple

```html
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>Mon Site</title>
</head>
<body>
  <header>
    <img data-bifrost="logo" src="logo.png" alt="Logo">
    <nav>
      <a href="/" data-bifrost="nav.home">Accueil</a>
      <a href="/about" data-bifrost="nav.about">A propos</a>
      <a href="/contact" data-bifrost="nav.contact">Contact</a>
    </nav>
  </header>

  <main>
    <section class="hero">
      <h1 data-bifrost="hero.title">Bienvenue sur notre site</h1>
      <p data-bifrost="hero.subtitle">Votre partenaire de confiance</p>
      <a href="/contact" data-bifrost="hero.cta">Nous contacter</a>
    </section>

    <section class="services">
      <h2 data-bifrost="services.title">Nos services</h2>
      <div class="service">
        <h3 data-bifrost="services.service1.title">Service 1</h3>
        <p data-bifrost="services.service1.desc">Description du service</p>
      </div>
      <div class="service">
        <h3 data-bifrost="services.service2.title">Service 2</h3>
        <p data-bifrost="services.service2.desc">Description du service</p>
      </div>
    </section>
  </main>

  <footer>
    <p data-bifrost="footer.copyright">2024 Mon Site</p>
  </footer>

  <script src="https://bifrost.example.com/loader.js" data-site="ma-cle-api"></script>
</body>
</html>
```

### Schema correspondant

```yaml
fields:
  logo:
    type: image
    label: "Logo"

  nav.home:
    type: text
    label: "Menu - Accueil"
  nav.about:
    type: text
    label: "Menu - A propos"
  nav.contact:
    type: text
    label: "Menu - Contact"

  hero.title:
    type: text
    label: "Titre hero"
  hero.subtitle:
    type: text
    label: "Sous-titre hero"
  hero.cta:
    type: text
    label: "Bouton hero"

  services.title:
    type: text
    label: "Titre services"
  services.service1.title:
    type: text
    label: "Service 1 - Titre"
  services.service1.desc:
    type: text
    label: "Service 1 - Description"
  services.service2.title:
    type: text
    label: "Service 2 - Titre"
  services.service2.desc:
    type: text
    label: "Service 2 - Description"

  footer.copyright:
    type: text
    label: "Copyright"
```

---

## Bonnes pratiques

### 1. Toujours fournir un contenu par defaut

```html
<!-- Bien -->
<h1 data-bifrost="title">Titre par defaut visible</h1>

<!-- Eviter -->
<h1 data-bifrost="title"></h1>
```

### 2. Utiliser des cles descriptives

```html
<!-- Bien -->
<p data-bifrost="about.company.description">...</p>

<!-- Eviter -->
<p data-bifrost="p1">...</p>
```

### 3. Grouper par section

```yaml
# Bien
fields:
  hero.title: ...
  hero.subtitle: ...
  about.title: ...
  about.description: ...

# Eviter
fields:
  title1: ...
  subtitle: ...
  title2: ...
  desc: ...
```

### 4. Definir le schema complet

Meme si le loader.js permet d'editer n'importe quel element `data-bifrost`, definir le schema permet :
- D'avoir tous les champs dans l'admin Bifrost
- De specifier les types (image, richtext)
- D'avoir des labels clairs pour les editeurs

---

## Depannage

### Le bouton "Editer" n'apparait pas

- Verifiez que `?edit=true` est dans l'URL
- Verifiez que le script loader.js est bien charge
- Verifiez la cle API dans la console (F12)

### Les modifications ne sont pas sauvegardees

- Verifiez que vous etes connecte
- Verifiez les erreurs dans la console
- Verifiez que l'API Bifrost est accessible

### Les images ne s'uploadent pas

- Verifiez que Cloudinary est configure sur le serveur
- Verifiez la taille de l'image (max 5 Mo)
- Verifiez le format (PNG, JPG, WebP)

---

## Ressources

- [Demo Bifrost](/demo) - Site de demonstration
- [API Documentation](/api) - Documentation de l'API
- [Admin Bifrost](/admin) - Interface d'administration
