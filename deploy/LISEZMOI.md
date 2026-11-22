# Mettre Bifrost en ligne sur le VPS

À faire une seule fois. Ensuite, chaque fusion dans `master` met Bifrost à jour toute seule.
Tout vit dans `/srv/bifrost` : le code, le fichier `.env` et `donnees/` (les sites des clients).

## 1. Le domaine

Dans la zone DNS de `ragnardrock.fr` : une entrée `A`, sous-domaine `bifrost`, vers l'IP du VPS
(et `AAAA` pour l'IPv6 si besoin).

## 2. Docker sur le VPS

```bash
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER      # puis se déconnecter / reconnecter
sudo mkdir -p /srv/bifrost/donnees/sites /srv/bifrost/donnees/import
sudo chown -R $USER /srv/bifrost
# Le serveur tourne sous le compte 1000 dans le conteneur : il doit pouvoir écrire les sites
sudo chown -R 1000:1000 /srv/bifrost/donnees
```

## 3. Le fichier `.env`

```bash
cd /srv/bifrost
curl -fsSLo .env https://raw.githubusercontent.com/RagnardRock/Bifrost/master/deploy/env.exemple
nano .env      # remplir DB_PASSWORD, JWT_SECRET (openssl rand -hex 32), et SMTP_URL (voir 7)
```

## 4. Caddy et HTTPS

Caddy reçoit le public, crée et renouvelle seul les certificats HTTPS (Bifrost et domaines des clients).

```bash
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update && sudo apt install -y caddy
sudo curl -fsSLo /etc/caddy/Caddyfile https://raw.githubusercontent.com/RagnardRock/Bifrost/master/deploy/Caddyfile
sudo nano /etc/caddy/Caddyfile     # remplacer bifrost.exemple.fr par l'adresse de Bifrost
sudo caddy validate --config /etc/caddy/Caddyfile && sudo systemctl reload caddy
```

Si le serveur a déjà nginx pour d'autres sites, chacun devient un bloc du Caddyfile, puis on arrête nginx
(`sudo systemctl disable --now nginx`) : les deux ne peuvent pas écouter les ports 80 et 443 en même temps.

## 5. Les secrets GitHub

Dépôt `Bifrost` › Settings › Secrets and variables › Actions : les mêmes que pour `ragnardrock-site`
(`VPS_HOTE`, `VPS_UTILISATEUR`, `VPS_CLE`, et `VPS_PORT` si SSH n'est pas sur 22).
La même clé de déploiement convient, si son compte peut écrire dans `/srv/bifrost` et utiliser Docker.

## 6. Premier envoi et compte dev

Onglet Actions › « Déployer Bifrost » › Run workflow (deux ou trois minutes la première fois). Puis, sur le VPS :

```bash
cd /srv/bifrost
docker compose exec bifrost npm run admin:creer -w @bifrost/server -- ton@email.fr "un-mot-de-passe-long"
```

L'espace dev est sur https://bifrost.ragnardrock.fr/admin/login.

## 7. Les e-mails (invitations, mot de passe oublié)

Il faut un compte SMTP, par exemple une boîte mail du domaine chez OVH, ou un service d'envoi
comme Brevo (offre gratuite). On met son adresse dans `SMTP_URL` :

```
SMTP_URL=smtps://bifrost%40ragnardrock.fr:MOTDEPASSE@ssl0.ovh.net:465
```

Puis `docker compose up -d` pour relire le `.env`. Sans SMTP, Bifrost marche quand même :
le lien d'invitation s'affiche à la personne qui invite, à transmettre à la main.

## 8. Ajouter un site client

1. **Espace dev › Nouveau site** : glisser le dossier du site (ou un ZIP) dans la zone prévue,
   ou cliquer sur « Choisir un dossier ». Le navigateur l'envoie directement, rien à faire en ligne de commande.
   (200 Mo au plus par envoi.)
2. *(Facultatif)* Un dossier déjà présent sur le serveur, dans `/srv/bifrost/donnees/import/`, peut aussi être
   importé : « Dossier déjà présent sur le serveur », puis son nom.
3. *(Facultatif)* **Servir le site sous son propre domaine** (sinon il reste visible sur `/sites/<nom>/`) :
   - chez le registrar du client, zone DNS : un enregistrement `A` pour le domaine et un pour `www`, vers l'IP du VPS ;
   - dans la fiche du site › Réglages › « Son propre domaine » : `https://ledomaine.fr`, puis « Vérifier le domaine ».

   C'est tout : à la première visite, Caddy demande à Bifrost si ce domaine est à lui, crée le certificat HTTPS,
   et Bifrost sert la version en ligne du site. Chaque « Publier » du client met le site à jour aussitôt.


## 9. Instagram (posts → actualités)

Le client relie son compte Instagram dans **Gérer › Réseaux**. Toutes les 30 minutes, Bifrost récupère
ses nouveaux posts et en fait des actualités du site (titre, date, texte, photos copiées sur le site), à relire
ou publiées tout de suite selon son choix. Bifrost ne publie jamais rien sur Instagram.

Il faut une appli Meta, une seule pour tous les clients (les menus de Meta changent souvent : les noms peuvent varier un peu) :

1. Sur [developers.facebook.com](https://developers.facebook.com/apps), **Créer une app**, cas d'usage
   « Gérer les messages et le contenu sur Instagram », type **Entreprise**.
2. Dans **Instagram › Configuration de l'API avec connexion Instagram** :
   - noter l'**ID de l'app Instagram** et la **clé secrète de l'app Instagram** (ce ne sont pas ceux de l'app Facebook) ;
   - à l'étape « Configurer la connexion professionnelle Instagram », ajouter l'adresse de retour :
     `<APP_URL>/api/reseaux/instagram/retour` (par exemple `https://bifrost.exemple.fr/api/reseaux/instagram/retour`).
3. Dans `.env` : `INSTAGRAM_APP_ID=…` et `INSTAGRAM_APP_SECRET=…`, puis relancer (`docker compose up -d`).
4. **Tant que l'app est « en développement »**, seuls les comptes ajoutés comme testeurs peuvent se relier :
   **Rôles de l'app › Rôles › Ajouter des personnes › Testeur Instagram**, puis le client accepte l'invitation dans
   Instagram (**Paramètres › Applications et sites web › Invitations de testeur**). C'est suffisant pour quelques clients.
5. Pour tous les clients sans invitation : passer l'app **en direct**, ce qui demande une URL de politique de
   confidentialité, la vérification de l'entreprise et l'**examen de l'app** pour la permission `instagram_business_basic`.

Le compte Instagram du client doit être **professionnel ou créateur** (gratuit : Paramètres › Type de compte et outils).
Le jeton dure 60 jours et Bifrost le renouvelle tout seul ; si Instagram le refuse un jour, la carte affiche
« reliez à nouveau le compte ».

## Sauvegarde

Deux choses comptent : la base et `donnees/sites`. Par exemple, chaque nuit (`crontab -e`) :

```
30 3 * * * cd /srv/bifrost && docker compose exec -T postgres pg_dump -U bifrost bifrost | gzip > /srv/sauvegardes/bifrost-$(date +\%u).sql.gz && tar czf /srv/sauvegardes/bifrost-sites-$(date +\%u).tgz donnees/sites
```

(une copie par jour de la semaine, gardée sept jours ; créer `/srv/sauvegardes` avant)

## En cas de souci

- `docker compose logs -f bifrost` : ce que dit le serveur.
- `docker compose ps` : l'état des deux conteneurs.
