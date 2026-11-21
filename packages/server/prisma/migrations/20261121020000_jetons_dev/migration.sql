-- Jetons d'accès des outils du dev (Rune)
CREATE TABLE "jetons_dev" (
    "id" TEXT NOT NULL,
    "admin_id" TEXT NOT NULL,
    "appareil" TEXT NOT NULL DEFAULT 'Rune',
    "hash" TEXT NOT NULL,
    "dernier_usage" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "jetons_dev_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "jetons_dev_hash_key" ON "jetons_dev"("hash");
CREATE INDEX "jetons_dev_admin_id_idx" ON "jetons_dev"("admin_id");

ALTER TABLE "jetons_dev" ADD CONSTRAINT "jetons_dev_admin_id_fkey" FOREIGN KEY ("admin_id") REFERENCES "admins"("id") ON DELETE CASCADE ON UPDATE CASCADE;
