# Bifrost

**L'éditeur sur place pour les sites de vos clients.** Le dev livre un site statique (HTML/CSS) ;
le client le modifie directement sur la page : textes, photos, liens, blocs à répéter, menu.
Rien ne change en ligne tant qu'il n'a pas cliqué sur « Publier ».

## Ce qu'il y a dedans

- **Éditeur sur place** : la page du site s'ouvre dans Bifrost, les zones modifiables sont marquées
  par des attributs `data-bf` dans le HTML (voir [docs/flags.md](docs/flags.md)).
- **Brouillon / en ligne / historique** : chaque site a ses fichiers dans `donnees/sites/<id>/` ;
  publier copie le brouillon vers la version en ligne et garde de quoi annuler.
- **Comptes clients** : invitation par e-mail, rôles responsable (publie, gère l'équipe) et rédacteur,
  mot de passe oublié par lien à usage unique.
- **Espace développeur** (`/admin`) : tous les sites, ce qui attend d'être publié, les équipes, le journal.
- Interface en verre dépoli, thème sombre / clair / comme l'appareil.

## En local

Prérequis : Node.js 20+, Docker (pour Postgres).

```bash
npm install
docker compose -f docker-compose.dev.yml up -d   # Postgres
cp .env.example .env                             # et packages/server/.env
npm run db:migrate
npm run admin:creer -w @bifrost/server -- dev@exemple.fr "un-mot-de-passe"
npm run dev
```

- Interface : http://localhost:5173 (espace dev : `/admin/login`)
- API : http://localhost:3000

Importer un site : espace dev › Nouveau site, avec le chemin du dossier du site.

## En ligne

Docker Compose (Postgres + Bifrost) derrière Caddy (HTTPS automatique, domaines des clients), mis à jour à chaque fusion dans `master`.
Le guide pas à pas est dans [deploy/LISEZMOI.md](deploy/LISEZMOI.md).

## Organisation

```
packages/
  client/   interface Vue 3 (connexion, éditeur, espace dev)
  server/   API Express + Prisma, aperçu des brouillons, script de l'éditeur (public/editeur)
  shared/   types communs
deploy/     Caddyfile, modèle de .env et guide de mise en ligne
```

## Tests

```bash
npm test
```
