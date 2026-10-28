import prisma from '../src/config/prisma.js';
import crypto from 'crypto';
const uuidv4 = () => crypto.randomUUID();

async function main() {
  console.log('Applying product catalogue additive migration...');

  // 1. Add description to products if missing
  try {
    const cols = await prisma.$queryRawUnsafe("SHOW COLUMNS FROM `products` LIKE 'description';");
    if (!cols || cols.length === 0) {
      await prisma.$executeRawUnsafe("ALTER TABLE `products` ADD COLUMN `description` TEXT NULL AFTER `name`;");
      console.log('Added description column to products table.');
    }
  } catch (err) {
    console.log('Column check/add note:', err.message);
  }

  // 2. Create product_categories table
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS \`product_categories\` (
      \`id\` CHAR(36) NOT NULL,
      \`company_id\` CHAR(36) NOT NULL,
      \`name\` VARCHAR(100) NOT NULL,
      \`description\` VARCHAR(255) NULL,
      \`created_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      \`updated_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      UNIQUE KEY \`product_categories_company_id_name_key\` (\`company_id\`, \`name\`),
      INDEX \`product_categories_company_id_idx\` (\`company_id\`),
      PRIMARY KEY (\`id\`),
      CONSTRAINT \`product_categories_company_id_fkey\` FOREIGN KEY (\`company_id\`) REFERENCES \`Admins\` (\`id\`) ON DELETE CASCADE ON UPDATE CASCADE
    ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
  `);
  console.log('Created product_categories table if not exists.');

  // 3. Create product_pricings table
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS \`product_pricings\` (
      \`id\` CHAR(36) NOT NULL,
      \`company_id\` CHAR(36) NOT NULL,
      \`product_id\` CHAR(36) NOT NULL,
      \`plan_name\` VARCHAR(100) NOT NULL DEFAULT 'Standard Rate',
      \`selling_price\` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
      \`purchase_price\` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
      \`tax_rate\` DECIMAL(5, 2) NOT NULL DEFAULT 18.00,
      \`discount_rate\` DECIMAL(5, 2) NOT NULL DEFAULT 0.00,
      \`valid_from\` DATETIME(3) NULL,
      \`valid_until\` DATETIME(3) NULL,
      \`is_default\` BOOLEAN NOT NULL DEFAULT FALSE,
      \`status\` VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
      \`created_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      \`updated_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      INDEX \`product_pricings_company_id_product_id_idx\` (\`company_id\`, \`product_id\`),
      PRIMARY KEY (\`id\`),
      CONSTRAINT \`product_pricings_company_id_fkey\` FOREIGN KEY (\`company_id\`) REFERENCES \`Admins\` (\`id\`) ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT \`product_pricings_product_id_fkey\` FOREIGN KEY (\`product_id\`) REFERENCES \`products\` (\`id\`) ON DELETE CASCADE ON UPDATE CASCADE
    ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
  `);
  console.log('Created product_pricings table if not exists.');

  // 4. Populate default categories for existing companies if empty
  const companies = await prisma.clientAdmin.findMany({ select: { id: true } });
  const defaultCategories = ['Raw Material', 'Finished Goods', 'WIP Semi-Finished', 'Packaging'];

  for (const c of companies) {
    // Existing categories from product table
    const existingProductCats = await prisma.$queryRawUnsafe(
      'SELECT DISTINCT category FROM products WHERE company_id = ? AND category IS NOT NULL AND category != "";',
      c.id
    );
    const catNames = new Set(defaultCategories);
    if (Array.isArray(existingProductCats)) {
      for (const row of existingProductCats) {
        if (row.category) catNames.add(row.category);
      }
    }

    for (const name of catNames) {
      try {
        await prisma.$executeRawUnsafe(
          'INSERT IGNORE INTO product_categories (id, company_id, name, description, created_at, updated_at) VALUES (?, ?, ?, ?, NOW(), NOW());',
          uuidv4(),
          c.id,
          name,
          `${name} items catalogue`
        );
      } catch (e) {
        // Ignore duplicate
      }
    }

    // Seed pricing records for existing products if not present
    const products = await prisma.$queryRawUnsafe(
      'SELECT id, selling_price, purchase_price FROM products WHERE company_id = ?;',
      c.id
    );
    if (Array.isArray(products)) {
      for (const p of products) {
        const existingPricing = await prisma.$queryRawUnsafe(
          'SELECT id FROM product_pricings WHERE product_id = ? LIMIT 1;',
          p.id
        );
        if (!existingPricing || existingPricing.length === 0) {
          await prisma.$executeRawUnsafe(
            `INSERT INTO product_pricings 
             (id, company_id, product_id, plan_name, selling_price, purchase_price, tax_rate, discount_rate, is_default, status, created_at, updated_at)
             VALUES (?, ?, ?, 'Standard Rate', ?, ?, 18.00, 0.00, 1, 'ACTIVE', NOW(), NOW());`,
            uuidv4(),
            c.id,
            p.id,
            p.selling_price || 0,
            p.purchase_price || 0
          );
        }
      }
    }
  }

  console.log('Additive migration and data synchronization complete.');
  process.exit(0);
}

main().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
