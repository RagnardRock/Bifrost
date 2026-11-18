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

1. Postgres : `docker compose -f docker-compose.dev.yml up -d` (si le port 5432 est pris, lancer le conteneur sur 5433 et l'indiquer dans `DATABASE_URL`).
2. Copier `.env.example` en `.env` à la racine **et** dans `packages/server` (Prisma lit ce dernier), puis `npm install` et `npx prisma migrate dev` dans `packages/server`.
3. Importer un site et créer le compte client :
   `npm run site:importer -w @bifrost/server -- <dossier-du-site> "<Nom du site>" <email-client> <mot-de-passe>`
4. `npm run dev` à la racine (compile d'abord le paquet partagé), puis se connecter sur `http://localhost:5173/login` avec l'e-mail et le mot de passe : l'éditeur s'ouvre directement.

## Comptes et équipe

- Connexion par e-mail et mot de passe, sans identifiant de site (si une personne gère plusieurs sites, elle choisit).
- Rôles : **responsable** (modifie, publie, revient en arrière, gère l'équipe) et **rédacteur** (modifie le brouillon ; un responsable publie).
- Bouton 👥 dans l'éditeur : inviter par e-mail, changer un rôle, retirer quelqu'un. L'invitation est un lien valable 7 jours ;
  la personne choisit son mot de passe et arrive dans l'éditeur. Il reste toujours au moins un responsable.
- Mot de passe oublié : lien valable 1 heure.
- Sans `SMTP_URL`, aucun e-mail ne part : le lien d'invitation s'affiche pour être copié, et les liens sont écrits dans la console du serveur.
- Le dev (compte admin) ouvre l'éditeur de n'importe quel site depuis la liste des sites (bouton « Éditer ») et y a les droits d'un responsable.

## Espace développeur

- Créer son compte dev : `npm run admin:creer -w @bifrost/server -- <email> <mot-de-passe>`, puis `http://localhost:5173/admin/login`.
- **Sites** : une carte par site (modifications en attente, membres, dernière publication et son auteur, dernière activité),
  boutons « Éditer » et « Fiche », et « + Nouveau site » qui crée le site et importe son dossier (chemin sur la machine du serveur).
- **Fiche d'un site** : fichiers en attente de publication, publications avec leur auteur, équipe, journal du site,
  nom et adresse en ligne, réimport du dossier après une refonte.
- **Activité** : le journal de tous les sites (modifications, photos, actualités, publications, annulations, invitations,
  arrivées dans l'équipe, changements de rôle), filtrable par site.
