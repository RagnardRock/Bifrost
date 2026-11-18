-- Un seul compte par personne : les comptes « une adresse sur un site » deviennent
-- une personne (users) + une ligne par site (membres). Les comptes d'une même adresse
-- sont fusionnés sur le plus ancien (dont le mot de passe est gardé).

CREATE TABLE "membres" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "site_id" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'responsable',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "membres_pkey" PRIMARY KEY ("id")
);

-- compte gardé pour chaque adresse
CREATE TEMP TABLE "fusion" AS
SELECT u."id" AS "ancien", first_value(u."id") OVER (PARTITION BY lower(u."email") ORDER BY u."created_at", u."id") AS "garde"
FROM "users" u;

INSERT INTO "membres" ("id", "user_id", "site_id", "role", "created_at")
SELECT gen_random_uuid()::text, f."garde", u."site_id", u."role", u."created_at"
FROM "users" u JOIN "fusion" f ON f."ancien" = u."id";

-- les traces (auteur des modifications) pointent vers le compte gardé
UPDATE "content_history" c SET "changed_by" = f."garde" FROM "fusion" f WHERE c."changed_by" = f."ancien" AND f."ancien" <> f."garde";
UPDATE "evenements" e SET "auteur" = f."garde" FROM "fusion" f WHERE e."auteur" = f."ancien" AND f."ancien" <> f."garde";
UPDATE "publications" p SET "auteur" = f."garde" FROM "fusion" f WHERE p."auteur" = f."ancien" AND f."ancien" <> f."garde";

DELETE FROM "users" u USING "fusion" f WHERE u."id" = f."ancien" AND f."ancien" <> f."garde";
DROP TABLE "fusion";

-- la personne n'appartient plus à un site
ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "users_site_id_fkey";
DROP INDEX IF EXISTS "users_site_id_email_key";
ALTER TABLE "users" DROP COLUMN "site_id";
ALTER TABLE "users" DROP COLUMN "role";
UPDATE "users" SET "email" = lower(trim("email"));
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

CREATE UNIQUE INDEX "membres_user_id_site_id_key" ON "membres"("user_id", "site_id");
CREATE INDEX "membres_site_id_idx" ON "membres"("site_id");
ALTER TABLE "membres" ADD CONSTRAINT "membres_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "membres" ADD CONSTRAINT "membres_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;
