/**
 * Seeds local dev data directly via `pg` (not through the services' own
 * APIs) so a fresh environment has usable stock levels and a couple of
 * customer ids to test checkouts against immediately after `bootstrap.sh`.
 *
 * Deliberately writes straight to inventory_service's read table rather
 * than replaying events through the event store - seed data isn't part
 * of any real event history, and pretending otherwise would pollute the
 * audit ledger with fake provenance.
 */
import 'dotenv/config';
import { Client } from 'pg';
import chalk from 'chalk';

const SEED_STOCK: { sku: string; description: string; qtyAvailable: number }[] = [
  { sku: 'SKU-42', description: 'Wireless Mechanical Keyboard', qtyAvailable: 250 },
  { sku: 'SKU-43', description: '4K Webcam', qtyAvailable: 120 },
  { sku: 'SKU-44', description: 'USB-C Dock, 12-in-1', qtyAvailable: 80 },
  { sku: 'SKU-45', description: 'Standing Desk Converter', qtyAvailable: 15 },
  { sku: 'SKU-DECLINE', description: 'Test SKU that always oversells (qty=0)', qtyAvailable: 0 },
];

async function main() {
  const client = new Client({
    host: process.env.DB_HOST ?? 'localhost',
    port: Number(process.env.DB_PORT ?? 5432),
    user: process.env.DB_USERNAME ?? 'saganova',
    password: process.env.DB_PASSWORD ?? 'saganova',
    database: process.env.DB_NAME ?? 'saganova',
  });

  await client.connect();
  console.log(chalk.cyan('Connected to Postgres for seeding.'));

  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS inventory_service.stock_level (
        sku TEXT PRIMARY KEY,
        description TEXT NOT NULL,
        qty_available INTEGER NOT NULL,
        qty_reserved INTEGER NOT NULL DEFAULT 0,
        version INTEGER NOT NULL DEFAULT 0,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);

    for (const item of SEED_STOCK) {
      await client.query(
        `INSERT INTO inventory_service.stock_level (sku, description, qty_available)
         VALUES ($1, $2, $3)
         ON CONFLICT (sku) DO UPDATE SET qty_available = EXCLUDED.qty_available, updated_at = now()`,
        [item.sku, item.description, item.qtyAvailable],
      );
      console.log(chalk.green(`  ✅ ${item.sku} -> ${item.qtyAvailable} units`));
    }

    console.log(chalk.cyan('\nTest customer ids for checkout:'));
    console.log('  cust_123        -> normal customer, payment succeeds');
    console.log('  cust_DECLINE    -> triggers PaymentDeclined (see payment-service mock adapter)');
    console.log(chalk.green('\n✅ Seed complete.'));
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(chalk.red('❌ Seeding failed:'), err);
  process.exit(1);
});
