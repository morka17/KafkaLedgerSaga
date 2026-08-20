#!/usr/bin/env ts-node
/**
 * Scaffolds a new domain event class straight into
 * libs/event-contracts/src/events/<domain>.events.ts, following the exact
 * shape every existing event (order/payment/inventory) already uses -
 * so nobody hand-rolls an envelope that drifts from convention, and every
 * new event is immediately importable as `@saganova/event-contracts`.
 *
 * Usage:
 *   npm run --workspace=@saganova/tools gen:event -- \
 *     --domain=shipping --name=ShipmentDispatched --aggregate=shipmentId
 *
 * If libs/event-contracts/src/events/shipping.events.ts already exists,
 * the new event class + enum member are appended to it instead of
 * overwriting the file.
 */
import { Command } from 'commander';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import chalk from 'chalk';

const TEMPLATES_DIR = resolve(__dirname, 'templates');
const EVENTS_DIR = resolve(__dirname, '../../libs/event-contracts/src/events');
const BARREL_FILE = resolve(__dirname, '../../libs/event-contracts/src/index.ts');

function toPascalCase(s: string): string {
  return s
    .replace(/[-_\s]+(.)?/g, (_, c) => (c ? c.toUpperCase() : ''))
    .replace(/^(.)/, (c) => c.toUpperCase());
}

function toConstCase(s: string): string {
  return s.replace(/([a-z0-9])([A-Z])/g, '$1_$2').replace(/[-\s]+/g, '_').toUpperCase();
}

function toKebabCase(s: string): string {
  return s.replace(/([a-z0-9])([A-Z])/g, '$1-$2').replace(/[\s_]+/g, '-').toLowerCase();
}

const program = new Command();
program
  .requiredOption('--domain <domain>', 'domain name, e.g. "shipping" (file: shipping.events.ts)')
  .requiredOption('--name <name>', 'event name in PascalCase or free text, e.g. "ShipmentDispatched"')
  .requiredOption('--aggregate <field>', 'aggregate id field name, e.g. "shipmentId"')
  .option('--topic <topic>', 'Kafka topic this event publishes to (defaults to "<domain>.events")');

program.parse(process.argv);
const opts = program.opts<{ domain: string; name: string; aggregate: string; topic?: string }>();

function main() {
  const domainPascal = toPascalCase(opts.domain);
  const eventPascal = toPascalCase(opts.name);
  const eventTypeString = `${toKebabCase(opts.name).replace(/-/g, '.')}.v1`;
  const eventConst = toConstCase(opts.name);
  const topicName = opts.topic ?? `${opts.domain}.events`;
  const topicConst = `${toConstCase(opts.domain)}_TOPIC`;

  if (!existsSync(EVENTS_DIR)) mkdirSync(EVENTS_DIR, { recursive: true });
  const eventFile = resolve(EVENTS_DIR, `${opts.domain}.events.ts`);

  if (!existsSync(eventFile)) {
    const template = readFileSync(resolve(TEMPLATES_DIR, 'event.template.ts'), 'utf-8');
    const rendered = template
      .replaceAll('{{TOPIC_CONST}}', topicConst)
      .replaceAll('{{TOPIC_NAME}}', topicName)
      .replaceAll('{{DOMAIN_PASCAL}}', domainPascal)
      .replaceAll('{{EVENT_CONST}}', eventConst)
      .replaceAll('{{EVENT_TYPE_STRING}}', eventTypeString)
      .replaceAll('{{EVENT_PASCAL}}', eventPascal)
      .replaceAll('{{AGGREGATE_ID_FIELD}}', opts.aggregate);

    writeFileSync(eventFile, rendered);
    console.log(chalk.green(`✅ Created ${eventFile}`));
  } else {
    // Append a new enum member + payload class to the existing domain file
    // rather than clobbering events other contributors already added.
    let content = readFileSync(eventFile, 'utf-8');

    const enumHeader = `export enum ${domainPascal}EventType {`;
    const enumStart = content.indexOf(enumHeader);

    if (enumStart === -1) {
      console.error(chalk.red(`❌ Could not find "${enumHeader}" in ${eventFile} - add the member manually.`));
      process.exit(1);
    }

    if (content.includes(`${eventConst} = '${eventTypeString}'`)) {
      console.log(chalk.yellow(`⚠️  ${eventConst} already exists in ${eventFile}, skipping enum edit.`));
    } else {
      // Find the FIRST closing brace after this specific enum's opening
      // brace - not the last brace in the file - so the new member lands
      // inside the enum even when other classes/enums follow it below.
      const enumClose = content.indexOf('\n}', enumStart);
      if (enumClose === -1) {
        console.error(chalk.red(`❌ Malformed enum block for ${domainPascal}EventType in ${eventFile}.`));
        process.exit(1);
      }
      const insertion = `  ${eventConst} = '${eventTypeString}',\n}`;
      content = content.slice(0, enumClose) + '\n' + insertion + content.slice(enumClose + 2);
    }

    const payloadClass = `

export class ${eventPascal}Payload {
  @IsUUID()
  ${opts.aggregate}!: string;

  // TODO: add the remaining fields this event carries.
}
`;
    content += payloadClass;
    writeFileSync(eventFile, content);
    console.log(chalk.green(`✅ Appended ${eventPascal}EventType + ${eventPascal}Payload to ${eventFile}`));
  }

  // Ensure the domain file is exported from the barrel.
  const barrel = readFileSync(BARREL_FILE, 'utf-8');
  const exportLine = `export * from './events/${opts.domain}.events';`;
  if (!barrel.includes(exportLine)) {
    writeFileSync(BARREL_FILE, barrel.trimEnd() + `\n${exportLine}\n`);
    console.log(chalk.green(`✅ Added export to ${BARREL_FILE}`));
  }

  console.log(chalk.cyan(`\nNext steps:`));
  console.log(`  1. Fill in the remaining fields on ${eventPascal}Payload.`);
  console.log(`  2. Add the emitting service's outbox write + producer call.`);
  console.log(`  3. Add a consumer in whichever service(s) react to it (e.g. saga-orchestrator).`);
}

main();
