/**
 * Seed Prisma — données initiales MVP Jour 1 (B5).
 *
 * Conforme au manifest MFE-JC (src/shared/manifest/manifests/mfe-jc.json) :
 * organisation XAF/fr/Africa/Douala/#FF6B00, catégories finance (dîme,
 * offrande…), groupes par défaut, admin. Idempotent (upsert / findFirst).
 *
 * Usage : npx prisma db seed  (ou : npx ts-node prisma/seed.ts)
 *
 * @traceability MVP-JOUR1-SPEC §3 (B5), DOC-021 (modèle physique)
 */
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const ORG_ID = 'mfe-jc';

const CATEGORIES = [
  { cle_vocabulaire: 'dime', libelle: 'Dîme', en: 'Tithe' },
  { cle_vocabulaire: 'offrande', libelle: 'Offrande', en: 'Offering' },
  { cle_vocabulaire: 'don', libelle: 'Don', en: 'Donation' },
  { cle_vocabulaire: 'budget_groupe', libelle: 'Budget groupe', en: 'Group budget' },
  { cle_vocabulaire: 'depense_culte', libelle: 'Dépense culte', en: 'Worship expense' },
  { cle_vocabulaire: 'transport', libelle: 'Transport', en: 'Transport' },
  { cle_vocabulaire: 'fournitures', libelle: 'Fournitures', en: 'Supplies' },
  { cle_vocabulaire: 'autre', libelle: 'Autre', en: 'Other' },
];

const GROUPES = ['Chorale', 'Jeunesse', 'Femmes', 'Hommes', 'Diaconie', 'Enseignement'];

async function main(): Promise<void> {
  // 1. Organisation MFE-JC (manifest mfe-jc.json : XAF, fr, Africa/Douala, accent #FF6B00)
  const org = await prisma.organization.upsert({
    where: { org_id: ORG_ID },
    update: {},
    create: {
      org_id: ORG_ID,
      nom: 'Mission Fête de Jésus-Christ (MFE-JC)',
      nom_court: 'MFE-JC',
      type_org: 'church',
      statut: 'active',
      devise_iso4217: 'XAF',
      fuseau_horaire: 'Africa/Douala',
      langue_privee: 'fr',
      accent_hex: '#FF6B00',
    },
  });

  // 2. Admin (email/mot de passe via env, défauts documentés)
  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? 'admin@mfe-jc.org';
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? 'Admin@2026!';
  const user = await prisma.user.upsert({
    where: { adresse_email_org_id: { adresse_email: adminEmail, org_id: ORG_ID } },
    update: { statut: 'active' },
    create: {
      org_id: ORG_ID,
      adresse_email: adminEmail,
      prenom: 'Admin',
      nom_famille: 'MFE-JC',
      role_utilisateur: 'admin',
      statut: 'active',
      is_active: true,
    },
  });
  const passwordHash = await bcrypt.hash(adminPassword, 10);
  await prisma.credential.upsert({
    where: { user_id: user.id },
    update: { hachage_mot_de_passe: passwordHash },
    create: { user_id: user.id, hachage_mot_de_passe: passwordHash },
  });

  // 3. Groupes par défaut (seed manuel — pas d'admin groupes en J1)
  for (const nom of GROUPES) {
    await prisma.orgUnit.upsert({
      where: { org_id_nom: { org_id: ORG_ID, nom } },
      update: { statut: 'active' },
      create: {
        org_id: ORG_ID,
        nom,
        type_unite: 'group',
        niveau_profondeur: 1,
        statut: 'active',
      },
    });
  }

  // 4. Catégories finance (pas de contrainte unique → findFirst + create)
  for (const cat of CATEGORIES) {
    const existing = await prisma.category.findFirst({
      where: { org_id: ORG_ID, cle_vocabulaire: cat.cle_vocabulaire },
    });
    if (!existing) {
      await prisma.category.create({
        data: { org_id: ORG_ID, cle_vocabulaire: cat.cle_vocabulaire, libelle: cat.libelle, active: true },
      });
    }
  }

  // 5. Namespace vocabulaire 'finance' + termes (GET /categories, formulaire E5)
  const ns = await prisma.vocabNamespace.upsert({
    where: { cle_namespace_org_id: { cle_namespace: 'finance', org_id: ORG_ID } },
    update: {},
    create: { org_id: ORG_ID, cle_namespace: 'finance', description: 'Catégories financières (manifest MFE-JC)' },
  });
  for (const cat of CATEGORIES) {
    await prisma.vocabTerm.upsert({
      where: { cle_term_namespace_id: { cle_term: cat.cle_vocabulaire, namespace_id: ns.id } },
      update: { label_fr: cat.libelle, label_en: cat.en },
      create: { namespace_id: ns.id, cle_term: cat.cle_vocabulaire, label_fr: cat.libelle, label_en: cat.en },
    });
  }

  console.log(
    `Seed OK — org=${org.org_id} admin=${adminEmail} groupes=${GROUPES.length} catégories=${CATEGORIES.length}`,
  );
}

main()
  .catch((err) => {
    console.error('Seed échoué :', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
