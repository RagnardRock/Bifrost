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

## 4. nginx et HTTPS

```bash
sudo curl -fsSLo /etc/nginx/sites-available/bifrost https://raw.githubusercontent.com/RagnardRock/Bifrost/master/deploy/nginx-bifrost.conf
sudo ln -s /etc/nginx/sites-available/bifrost /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d bifrost.ragnardrock.fr
```

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

1. **Déposer le dossier du site** dans `/srv/bifrost/donnees/import/` depuis le PC (PowerShell) :
   ```powershell
   scp -r D:\Projets\ehpad-saintpaulien compte@vps:/srv/bifrost/donnees/import/
   ```
   puis sur le VPS : `sudo chown -R 1000:1000 /srv/bifrost/donnees/import`
2. **Espace dev › Nouveau site** : dans « Dossier », juste le nom : `ehpad-saintpaulien`.
3. **Servir le site** sous son domaine : DNS du domaine (`A` et `www`) vers l'IP du VPS, puis
   ```bash
   sudo curl -fsSLo /etc/nginx/sites-available/ehpad https://raw.githubusercontent.com/RagnardRock/Bifrost/master/deploy/nginx-site-client.conf
   sudo nano /etc/nginx/sites-available/ehpad   # remplacer DOMAINE et ID_DU_SITE (lu dans l'adresse de sa fiche)
   sudo ln -s /etc/nginx/sites-available/ehpad /etc/nginx/sites-enabled/
   sudo nginx -t && sudo systemctl reload nginx
   sudo certbot --nginx -d ehpad-saintpaulien.fr -d www.ehpad-saintpaulien.fr
   ```
   Chaque « Publier » du client met le site à jour aussitôt : nginx lit directement la version en ligne.

Le dossier déposé peut être effacé après l'import (Bifrost en garde sa propre copie).

## Sauvegarde

Deux choses comptent : la base et `donnees/sites`. Par exemple, chaque nuit (`crontab -e`) :

```
30 3 * * * cd /srv/bifrost && docker compose exec -T postgres pg_dump -U bifrost bifrost | gzip > /srv/sauvegardes/bifrost-$(date +\%u).sql.gz && tar czf /srv/sauvegardes/bifrost-sites-$(date +\%u).tgz donnees/sites
```

(une copie par jour de la semaine, gardée sept jours ; créer `/srv/sauvegardes` avant)

## En cas de souci

- `docker compose logs -f bifrost` : ce que dit le serveur.
- `docker compose ps` : l'état des deux conteneurs.
