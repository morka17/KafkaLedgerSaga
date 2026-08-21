/**
 * Runs `npm run migration:run` for every service in MIGRATABLE_SERVICES,
 * sequentially, stopping on the first failure. Sequential (not parallel)
 * is deliberate: it keeps failure output attributable to one service at
 * a time and avoids N services hammering Postgres connection limits
 * simultaneously in constrained CI runners.
 *
 * Usage: npm run --workspace=@saganova/tools migrate:run-all
 *        npm run --workspace=@saganova/tools migrate:run-all -- --only=order-service
 */
import 'dotenv/config';
import { spawnSync } from 'child_process';
import { resolve } from 'path';
import chalk from 'chalk';
import { MIGRATABLE_SERVICES } from './service-registry';

function parseOnlyFlag(): string | undefined {
  const arg = process.argv.find((a) => a.startsWith('--only='));
  return arg?.split('=')[1];
}

async function main() {
  const only = parseOnlyFlag();
  const targets = only
    ? MIGRATABLE_SERVICES.filter((s) => s.appDir === only)
    : MIGRATABLE_SERVICES;

  if (targets.length === 0) {
    console.error(chalk.red(`No matching service for --only=${only}`));
    process.exit(1);
  }

  console.log(chalk.cyan(`Running migrations for ${targets.length} service(s)...\n`));

  for (const service of targets) {
    const appPath = resolve(__dirname, '../../apps', service.appDir);
    process.stdout.write(chalk.yellow(`→ ${service.appDir} (schema: ${service.schema})... `));

    const result = spawnSync('npm', ['run', 'migration:run'], {
      cwd: appPath,
      env: { ...process.env, DB_SCHEMA: service.schema },
      encoding: 'utf-8',
    });

    if (result.status !== 0) {
      console.log(chalk.red('FAILED'));
      console.error(result.stdout);
      console.error(result.stderr);
      console.error(chalk.red(`\n❌ Migration failed for ${service.appDir}. Stopping - later services were not migrated.`));
      process.exit(1);
    }

    console.log(chalk.green('OK'));
  }

  console.log(chalk.green(`\n✅ All migrations applied (${targets.length} service(s)).`));
}

main().catch((err) => {
  console.error(chalk.red('Unexpected error:'), err);
  process.exit(1);
});
