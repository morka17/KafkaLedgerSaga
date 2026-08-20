#!/usr/bin/env ts-node
/**
 * Scaffolds a new SagaStep definition file into
 * apps/saga-orchestrator/src/orchestrator/steps/<step-name>.step.ts,
 * pre-wired against @saganova/saga-toolkit's SagaStep interface. The
 * generated file is deliberately NOT auto-inserted into
 * order-fulfillment.saga-definition.ts - step ORDER is a business
 * decision a human has to make, codegen only removes the boilerplate.
 *
 * Usage:
 *   npm run --workspace=@saganova/tools gen:saga-step -- \
 *     --name=ChargeLoyaltyPoints \
 *     --command=CHARGE_LOYALTY_POINTS_COMMAND \
 *     --success=loyalty.points_charged.v1 \
 *     --failure=loyalty.charge_failed.v1
 */
import { Command } from 'commander';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import chalk from 'chalk';

const TEMPLATES_DIR = resolve(__dirname, 'templates');
const STEPS_DIR = resolve(__dirname, '../../apps/saga-orchestrator/src/orchestrator/steps');

function toPascalCase(s: string): string {
  return s.replace(/[-_\s]+(.)?/g, (_, c) => (c ? c.toUpperCase() : '')).replace(/^(.)/, (c) => c.toUpperCase());
}
function toCamelCase(s: string): string {
  const pascal = toPascalCase(s);
  return pascal.charAt(0).toLowerCase() + pascal.slice(1);
}
function toKebabCase(s: string): string {
  return s.replace(/([a-z0-9])([A-Z])/g, '$1-$2').replace(/[\s_]+/g, '-').toLowerCase();
}

const program = new Command();
program
  .requiredOption('--name <name>', 'step name, e.g. "ChargeLoyaltyPoints"')
  .requiredOption('--command <constName>', 'exported command constant name from event-contracts, e.g. CHARGE_LOYALTY_POINTS_COMMAND')
  .requiredOption('--success <eventType>', 'event type string that signals success, e.g. loyalty.points_charged.v1')
  .requiredOption('--failure <eventType>', 'event type string that signals failure, e.g. loyalty.charge_failed.v1');

program.parse(process.argv);
const opts = program.opts<{ name: string; command: string; success: string; failure: string }>();

function main() {
  const stepPascal = toPascalCase(opts.name);
  const stepCamel = toCamelCase(opts.name);
  const stepKebab = toKebabCase(opts.name);
  const commandPascal = toPascalCase(opts.command.replace(/_COMMAND$/i, ''));

  if (!existsSync(STEPS_DIR)) mkdirSync(STEPS_DIR, { recursive: true });
  const stepFile = resolve(STEPS_DIR, `${stepKebab}.step.ts`);

  if (existsSync(stepFile)) {
    console.error(chalk.red(`❌ ${stepFile} already exists. Pick a different --name or edit it directly.`));
    process.exit(1);
  }

  const template = readFileSync(resolve(TEMPLATES_DIR, 'saga-step.template.ts'), 'utf-8');
  const rendered = template
    .replaceAll('{{STEP_PASCAL}}', stepPascal)
    .replaceAll('{{STEP_CAMEL}}', stepCamel)
    .replaceAll('{{STEP_NAME}}', opts.name)
    .replaceAll('{{COMMAND_CONST}}', opts.command)
    .replaceAll('{{COMMAND_PASCAL}}', commandPascal)
    .replaceAll('{{SUCCESS_EVENT}}', opts.success)
    .replaceAll('{{FAILURE_EVENT}}', opts.failure);

  writeFileSync(stepFile, rendered);
  console.log(chalk.green(`✅ Created ${stepFile}`));

  console.log(chalk.cyan(`\nNext steps:`));
  console.log(`  1. Confirm ${opts.command} exists in @saganova/event-contracts (generate it if not).`);
  console.log(`  2. Import ${stepCamel}Step into order-fulfillment.saga-definition.ts and insert it`);
  console.log(`     at the correct position in the steps[] array.`);
  console.log(`  3. If this step has a side effect to undo, add compensationCommand +`);
  console.log(`     buildCompensationPayload, and a matching *.compensator.ts.`);
}

main();
