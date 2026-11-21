-- Double authentification (code d'une appli d'authentification) pour les comptes clients et dev
ALTER TABLE "users" ADD COLUMN "totp_secret" TEXT;
ALTER TABLE "users" ADD COLUMN "totp_actif" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN "totp_dernier" INTEGER;
ALTER TABLE "users" ADD COLUMN "codes_secours" TEXT[] DEFAULT ARRAY[]::TEXT[];

ALTER TABLE "admins" ADD COLUMN "totp_secret" TEXT;
ALTER TABLE "admins" ADD COLUMN "totp_actif" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "admins" ADD COLUMN "totp_dernier" INTEGER;
ALTER TABLE "admins" ADD COLUMN "codes_secours" TEXT[] DEFAULT ARRAY[]::TEXT[];
