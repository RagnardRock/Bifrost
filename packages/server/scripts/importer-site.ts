/**
 * Met en place un site statique dans Bifrost (essais en local, avant l'interface dev).
 *
 *   npm run site:importer -w @bifrost/server -- <dossier-du-site> "<Nom du site>" [email-client] [mot-de-passe]
 *
 * Crée le site s'il n'existe pas (même nom), copie le dossier dans donnees/sites/<id>/ (brouillon + publie)
 * et crée le compte client s'il est fourni.
 */
import path from 'path'
import { nanoid } from 'nanoid'
import { prisma } from '../src/config/database'
import { hashPassword } from '../src/utils/hash'
import { importer } from '../src/services/site-fichiers.service'

async function main() {
  const [dossier, nom, email, motDePasse] = process.argv.slice(2)
  if (!dossier || !nom) {
    console.error('Usage : importer-site <dossier> "<Nom>" [email-client] [mot-de-passe]')
    process.exit(1)
  }
  let site = await prisma.site.findFirst({ where: { name: nom } })
  if (!site) site = await prisma.site.create({ data: { name: nom, url: '', apiKey: `bf_${nanoid(32)}` } })
  const { pages } = await importer(site.id, path.resolve(dossier))
  console.log(`Site « ${nom} » : ${site.id} (${pages.length} pages)`)
  if (email && motDePasse) {
    await prisma.user.upsert({
      where: { siteId_email: { siteId: site.id, email } },
      update: { passwordHash: await hashPassword(motDePasse) },
      create: { siteId: site.id, email, passwordHash: await hashPassword(motDePasse) },
    })
    console.log(`Compte client : ${email}`)
  }
  console.log(`Éditeur : http://localhost:5173/edition/${site.id}`)
}

main().finally(() => prisma.$disconnect())
