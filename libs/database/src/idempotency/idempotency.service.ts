import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { ProcessedMessageRow } from './processed-message.entity';

@Injectable()
export class IdempotencyService {
  constructor(
    @InjectRepository(ProcessedMessageRow)
    private readonly repo: Repository<ProcessedMessageRow>,
  ) {}

  async isProcessed(messageId: string): Promise<boolean> {
    const count = await this.repo.count({ where: { messageId } });
    return count > 0;
  }

  async markProcessed(manager: EntityManager, messageId: string, messageType: string): Promise<void> {
    await manager.insert(ProcessedMessageRow, { messageId, messageType });
  }
}
