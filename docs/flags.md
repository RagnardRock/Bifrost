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
Pour un lien `tel:` ou `mailto:`, l'adresse du lien suit le numéro ou l'e-mail saisi (`04 71 22 33 44` → `tel:+33471223344` si l'ancien lien était en +33), ainsi que les autres liens de la page vers le même numéro (un bouton « Appeler », par exemple).

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

## Formulaires

Un formulaire marqué `data-bf-formulaire="nom"` envoie ses messages à Bifrost, sans rien à installer côté site.

| Attribut | Rôle |
|---|---|
| `data-bf-formulaire="contact"` | Le formulaire à brancher (lettres, chiffres, tirets). |
| `data-bf-merci="merci.html"` | Facultatif : page affichée après l'envoi (sinon une page « Message envoyé » de Bifrost, avec un lien de retour). |

```html
<form data-bf-formulaire="contact">
  <label>Nom <input name="nom" required></label>
  <label>E-mail <input type="email" name="email" required></label>
  <label>Message <textarea name="message" required></textarea></label>
  <button type="submit">Envoyer</button>
</form>
```

- À l'import, Bifrost ajoute `action` (son adresse `APP_URL/api/formulaires/<site>/<nom>`), `method="post"` et un champ piège invisible contre les robots.
  Réimporter le site si `APP_URL` change.
- Seuls les champs présents dans le formulaire **publié** sont gardés ; le libellé vient du `<label>` (ou du `placeholder`). `required` est vérifié côté serveur.
- Le premier champ `type="email"` sert d'adresse de réponse : « Répondre » dans l'éditeur, et Répondre directement à l'e-mail de notification.
- Chaque message est enregistré, envoyé par e-mail aux **responsables** du site (ou aux adresses réglées dans la fiche du site, « Messages du formulaire envoyés à »), et visible dans l'éditeur (bouton 📨, avec le nombre de non lus).
- Limite : 8 envois par quart d'heure et par visiteur, 5 000 caractères par champ.
- Envoi en JavaScript (pour afficher « Merci » sans quitter la page) : `fetch(form.action, { method: 'POST', body: new FormData(form), headers: { Accept: 'application/json' } })`
  répond `{ success: true }`, ou `{ success: false, error: { message } }` à afficher au visiteur.

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

## Mode dev (poser les flags depuis l'éditeur)

Le compte dev voit un bouton **🛠️ Dev** dans la barre de l'éditeur. En mode dev :

- un clic sélectionne **n'importe quel** élément de la page (flaggé ou non) ; `Échap` remonte au parent, le fil d'Ariane du panneau aussi ;
- le panneau **Élément** pose ou retire `data-bf` (avec une clé proposée : `section.titre` hors liste, `titre` dans un élément de liste), `data-bf-type`, `data-bf-liste` + `data-bf-limite`, `data-bf-element`, `data-bf-page` ;
- double-clic (ou `Entrée`) sur un élément sans enfants : modifier son texte ; le panneau règle aussi `alt`, `href` et `title` ;
- ↑ ↓, Dupliquer, Supprimer (`Suppr`) agissent sur l'élément sélectionné ;
- l'onglet **Flags de la page** liste tous les flags et signale les problèmes (liste sans élément, élément hors liste, clé en double avec des contenus différents, flag dans un texte riche, image sans `alt`).

Tout est écrit dans le brouillon, comme les modifications du client, puis publié avec « Publier ».
Côté serveur : `POST /api/editeur/<site>/dev`, réservé au compte dev ; l'élément est désigné par son chemin depuis `<body>`
avec la balise attendue à chaque étape (refus si la page a changé entre-temps).

### Sections toutes faites (blocs)

Onglet **Blocs** du panneau dev : en-tête, texte, texte et photo, cartes, galerie, équipe, partenaires, questions fréquentes, horaires, formulaire de contact.

- Glisser un bloc dans la page (un trait violet montre où il ira), ou cliquer dessus : il s'ajoute après l'élément sélectionné, sinon à la fin de la page.
- Les flags sont déjà posés. Si une clé existe déjà dans le site, elle est renommée (`galerie` → `galerie-2`) pour ne pas écraser l'autre.
- Les blocs fournis utilisent `assets/bifrost-blocs.css` (copiée et liée à l'ajout). Polices et couleurs viennent du site ; les variables `--bf-accent`, `--bf-rayon`, `--bf-largeur`, `--bf-fond-doux`, `--bf-trait` les règlent.
- Un formulaire de contact ajouté est branché sur Bifrost tout de suite.
- **Glisser l'élément sélectionné** le déplace : une section parmi les sections, un élément plus petit parmi ses voisins (cartes d'une grille…).
- **⭐ Enregistrer comme bloc** (onglet Élément) garde l'élément sélectionné dans « Mes blocs », réutilisable sur tous les sites (`<SITES_DIR>/_blocs/`).
- Ajouter un bloc fourni : `packages/server/blocs/<id>.html`, avec en première ligne `<!-- {"nom": "…", "icone": "…", "description": "…"} -->`.

## Depuis Rune (l'IDE du dev)

Le panneau Bifrost de Rune (icône globe) utilise l'API `/api/dev` :

- `POST /api/dev/connexion` `{ email, motDePasse, appareil }` → un jeton `bfd_…` long et révocable (seule son empreinte est gardée, table `jetons_dev`).
  Les autres appels l'envoient en `Authorization: Bearer`. `GET /jetons` et `DELETE /jetons/:id` listent et retirent les appareils connectés.
- `GET /sites`, `GET /sites/:site` : les sites, et la fiche d'un site avec les modifications pas encore publiées (`enAttente`) et les publications.
- `GET /sites/:site/manifeste?version=publie|brouillon` et `GET /sites/:site/fichier?chemin=…&version=…` : pour rapatrier les modifications du client dans les fichiers du dev.
- `POST /sites/:site/envoi/essai` puis `POST /sites/:site/envoi` : `{ manifeste: { chemin: sha1 }, fichiers: { chemin: base64 }, supprimer, ecraserBrouillon, depuis }`.
  L'essai répond ce qui changerait en ligne, les fichiers que Bifrost n'a pas encore (`manquants`), les modifications non publiées du client et ses publications depuis `depuis`.
  L'envoi devient une **publication** du dev, avec historique (on peut revenir en arrière). Il est refusé si le client a des modifications non publiées, sauf `ecraserBrouillon`.
  Les fichiers absents du dossier du dev restent en ligne, sauf `supprimer`. Les formulaires sont branchés comme à l'import.
