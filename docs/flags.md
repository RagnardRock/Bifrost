# Flags Bifrost (éditeur sur place)

Bifrost lit le HTML statique d'un site et rend modifiables les zones marquées par des attributs `data-bf`.
Le dev pose les flags, le client modifie le contenu directement sur la page, puis publie.

## Champs

| Attribut | Rôle |
|---|---|
| `data-bf="cle"` | Zone modifiable. Le type est deviné : `<img>` → image, `<a>` → lien, sinon texte. |
| `data-bf-type="riche"` | Texte mis en forme (gras, italique, listes, liens). Nettoyé côté serveur. |

Une clé hors liste est modifiée sur **toutes les pages** où elle apparaît (`site.nom`, `contact.telephone`…).
Si un champ ne contient qu'un lien, c'est le texte du lien qui est modifié.

```html
<h1 data-bf="accueil.titre">Bienvenue</h1>
<img data-bf="accueil.photo" src="assets/img/facade.jpg" alt="">
<div data-bf="accueil.texte" data-bf-type="riche"><p>…</p></div>
```

## Listes

| Attribut | Rôle |
|---|---|
| `data-bf-liste="nom"` | Conteneur d'une liste répétable. |
| `data-bf-element` | Un élément de la liste (monter, descendre, dupliquer, supprimer). |
| `data-bf-limite="N"` | La liste n'affiche que les N premiers éléments (ex. 3 dernières actus sur l'accueil). |

## Collections

Une liste devient une **collection** quand une page sert de modèle : `data-bf-page="nom"` sur un élément de la page modèle.
« + Actualité » crée alors une nouvelle page à partir du modèle et ajoute sa carte en tête de toutes les listes complètes ;
les listes limitées sont recalculées. Supprimer une carte supprime aussi sa page.

```html
<!-- actualites.html -->
<ul data-bf-liste="actualites">
  <li data-bf-element><a href="actualites/fete.html"><h3 data-bf="titre">Fête</h3></a></li>
</ul>
<!-- index.html -->
<ul data-bf-liste="actualites" data-bf-limite="3">…</ul>
<!-- actualites/modele.html -->
<article data-bf-page="actualites">…</article>
```

## Fichiers

```
<SITES_DIR>/<siteId>/
  brouillon/                ce que le client modifie (aperçu dans l'éditeur)
  publie/                   la version en ligne
  historique/<publication>/ les fichiers remplacés par une publication (retour en arrière)
```

Les images envoyées sont converties en WebP (1600 px max) dans `brouillon/medias/`.

## Essai en local

1. Postgres lancé, `.env` à la racine avec `DATABASE_URL` et `JWT_SECRET`.
2. `npm install`, puis `npx prisma migrate dev` dans `packages/server`.
3. Importer un site et créer le compte client :
   `npm run site:importer -w @bifrost/server -- <dossier-du-site> "<Nom du site>" <email-client> <mot-de-passe>`
4. `npm run dev`, se connecter avec le compte client : l'éditeur s'ouvre sur `/edition/<siteId>`.
