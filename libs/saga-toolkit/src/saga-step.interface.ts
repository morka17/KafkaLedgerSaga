/**
 * One step in a saga's step graph. `command` is what gets published to
 * move the saga forward; `compensationCommand` is what gets published to
 * undo this step's effect if a LATER step fails.
 *
 * Steps are pure descriptions - the actual FSM (SagaStateMachine) is what
 * walks this array, publishes commands, and reacts to the resulting events.
 */
export interface SagaStep<TContext = Record<string, unknown>> {
    name: string;
  
    /** Kafka command `type` published to trigger this step. */
    command: string;
  
    /** Builds the command payload from the accumulated saga context. */
    buildCommandPayload: (ctx: TContext) => unknown;
  
    /** Event `type` that signals this step succeeded. */
    successEvent: string;
  
    /** Event `type` that signals this step failed. */
    failureEvent: string;
  
    /** Command published to undo this step. Omit for steps with no side effect to undo (e.g. the first step). */
    compensationCommand?: string;
    buildCompensationPayload?: (ctx: TContext) => unknown;
  }
  
  export type SagaStatus =
    | 'STARTED'
    | 'IN_PROGRESS'
    | 'COMPLETED'
    | 'COMPENSATING'
    | 'COMPENSATED'
    | 'FAILED';
  
  export interface SagaInstanceSnapshot<TContext = Record<string, unknown>> {
    sagaId: string;
    definitionName: string;
    currentStepIndex: number;
    status: SagaStatus;
    context: TContext;
    history: { step: string; event: string; at: string }[];
  }
  
  /** A full saga = an ordered list of steps + a name for logging/persistence. */
  export interface SagaDefinition<TContext = Record<string, unknown>> {
    name: string;
    steps: SagaStep<TContext>[];
  }
  /**
 * One step in a saga's step graph. `command` is what gets published to
 * move the saga forward; `compensationCommand` is what gets published to
 * undo this step's effect if a LATER step fails.
 *
 * Steps are pure descriptions - the actual FSM (SagaStateMachine) is what
 * walks this array, publishes commands, and reacts to the resulting events.
 */
export interface SagaStep<TContext = Record<string, unknown>> {
    name: string;
  
    /** Kafka command `type` published to trigger this step. */
    command: string;
  
    /** Builds the command payload from the accumulated saga context. */
    buildCommandPayload: (ctx: TContext) => unknown;
  
    /** Event `type` that signals this step succeeded. */
    successEvent: string;
  
    /** Event `type` that signals this step failed. */
    failureEvent: string;
  
    /** Command published to undo this step. Omit for steps with no side effect to undo (e.g. the first step). */
    compensationCommand?: string;
    buildCompensationPayload?: (ctx: TContext) => unknown;
  }
  
  
  export interface SagaInstanceSnapshot<TContext = Record<string, unknown>> {
    sagaId: string;
    definitionName: string;
    currentStepIndex: number;
    status: SagaStatus;
    context: TContext;
    history: { step: string; event: string; at: string }[];
  }
  
  /** A full saga = an ordered list of steps + a name for logging/persistence. */
  export interface SagaDefinition<TContext = Record<string, unknown>> {
    name: string;
    steps: SagaStep<TContext>[];
  }
  