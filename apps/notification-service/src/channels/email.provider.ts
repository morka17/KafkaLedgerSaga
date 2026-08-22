import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class EmailProvider {
  private readonly logger = new Logger(EmailProvider.name);

  async sendTransactionalEmail(subject: string, body: string, targetKey: string): Promise<void> {
    this.logger.log(`EMAIL [${targetKey}] ${subject}: ${body}`);
  }
}
