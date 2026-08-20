import { IsUUID } from 'class-validator';

export const {{TOPIC_CONST}} = '{{TOPIC_NAME}}';

export enum {{DOMAIN_PASCAL}}EventType {
  {{EVENT_CONST}} = '{{EVENT_TYPE_STRING}}',
}

export class {{EVENT_PASCAL}}Payload {
  @IsUUID()
  {{AGGREGATE_ID_FIELD}}!: string;

  // TODO: add the remaining fields this event carries.
}
