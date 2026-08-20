import { IsUUID } from 'class-validator';

export const {{COMMAND_CONST}} = '{{COMMAND_TYPE_STRING}}';

export class {{COMMAND_PASCAL}}CommandPayload {
  @IsUUID()
  orderId!: string;

  // TODO: add the remaining fields this command needs.
}
