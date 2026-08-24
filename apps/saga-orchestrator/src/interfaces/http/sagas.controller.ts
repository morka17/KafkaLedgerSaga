import { Controller, Get, NotFoundException, Param, ParseUUIDPipe } from '@nestjs/common';
import { SagaInstanceRepository } from '../../infrastructure/postgres/saga-instance.repository';

/**
 * The read API api-gateway's OrdersService.getOrderStatus() proxies to
 * (see SAGA_ORCHESTRATOR_URL in api-gateway). Internal-only - not exposed
 * publicly.
 */
@Controller('sagas')
export class SagasController {
  constructor(private readonly instanceRepository: SagaInstanceRepository) {}

  @Get(':orderId')
  async getStatus(@Param('orderId', ParseUUIDPipe) orderId: string) {
    const entity = await this.instanceRepository.findById(orderId);
    if (!entity) {
      throw new NotFoundException(`No saga found for order ${orderId}`);
    }

    const stepName = ['RESERVE_INVENTORY', 'AUTHORIZE_PAYMENT'][entity.currentStepIndex] ?? 'UNKNOWN';

    return {
      orderId: entity.sagaId,
      sagaStatus: entity.status,
      currentStep: stepName,
      history: entity.history,
    };
  }
}
