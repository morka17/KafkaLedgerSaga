import { SagaStep } from '@saganova/saga-toolkit';
import {
  {{COMMAND_CONST}},
  {{COMMAND_PASCAL}}CommandPayload,
} from '@saganova/event-contracts';

export interface {{STEP_PASCAL}}Context {
  orderId: string;
  // TODO: extend with whatever context this step reads/writes.
}

/**
 * {{STEP_PASCAL}} saga step.
 * Add to the step array in order-fulfillment.saga-definition.ts at the
 * position where this step belongs in the transaction.
 */
export const {{STEP_CAMEL}}Step: SagaStep<{{STEP_PASCAL}}Context> = {
  name: '{{STEP_NAME}}',
  command: {{COMMAND_CONST}},
  buildCommandPayload: (ctx): {{COMMAND_PASCAL}}CommandPayload => ({
    orderId: ctx.orderId,
    // TODO: map remaining context fields to the command payload.
  }),
  successEvent: '{{SUCCESS_EVENT}}',
  failureEvent: '{{FAILURE_EVENT}}',
  // TODO: set compensationCommand + buildCompensationPayload if this step
  // has a side effect that must be undone when a LATER step fails.
};
