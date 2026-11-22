# Données personnelles (RGPD)

Ce que Bifrost garde, où, combien de temps, et comment c'est protégé. Cette page sert de base
au registre des traitements et à la clause « sous-traitant » des conditions de vente : pour les
données des visiteurs, le client est **responsable du traitement** et le dev qui héberge Bifrost
est **sous-traitant**.

## Ce qui est gardé

| Données | Qui | Pourquoi | Durée |
|---|---|---|---|
| Messages des formulaires (champs remplis, e-mail) | visiteurs des sites | transmettre la demande au client | **12 mois**, puis effacés automatiquement (`CONSERVATION_MESSAGES_MOIS`) |
| Comptes (e-mail, mot de passe chiffré, double authentification) | clients et dev | se connecter | tant que le compte existe |
| Journal d'activité (qui a modifié ou publié quoi) | clients | suivi et assistance | **24 mois** (`CONSERVATION_JOURNAL_MOIS`) |
| Historique des publications | clients | revenir en arrière | tant que le site existe |
| Liens d'invitation et de mot de passe oublié | clients | ouvrir un compte | effacés 1 mois après leur expiration |
| Envois de webhooks | — | réessayer un envoi raté | 3 mois |
| Appareils pour les notifications | clients | prévenir sur le téléphone | jusqu'au retrait de l'appareil |
| Comptes de réseaux sociaux reliés (jeton Instagram) | clients | importer les posts | jusqu'à la déconnexion |
| Sauvegardes de nuit | tout ce qui précède | reprise après incident | 7 jours |

Un site supprimé part à la corbeille, puis il est effacé définitivement au bout de 30 jours avec
tous ses messages, son journal et ses publications.

Bifrost ne pose aucun cookie aux visiteurs des sites et ne fait pas de suivi publicitaire.
Le seul cookie de l'interface est la session (`bf_session`), nécessaire à la connexion.

## Où

- Serveur : le VPS du dev (OVH), base PostgreSQL et fichiers des sites. Vérifier que le centre de données est dans l’Union européenne.
- E-mails : le service SMTP réglé dans `SMTP_URL`.
- Instagram (si relié) : Meta, pour lire les posts du compte du client.

## Protection

- HTTPS partout (Caddy), mots de passe chiffrés (bcrypt), double authentification
  (obligatoire pour le compte dev).
- Session dans un cookie que les pages ne peuvent pas lire, protégée contre le CSRF.
- Nombre de tentatives de connexion limité, HTML nettoyé à l'enregistrement.
- Sauvegarde chaque nuit.

## Droits des personnes

- **Accès, export** : le client récupère son site complet en ZIP, et ses messages depuis l'éditeur.
- **Effacement** : un message peut être supprimé par le client ; un compte ou un site par le dev,
  sur demande.
- Une demande d'un visiteur passe par le client (responsable du traitement), qui la transmet au dev.
