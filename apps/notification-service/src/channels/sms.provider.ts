import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class SmsProvider {
  private readonly logger = new Logger(SmsProvider.name);

  async sendSms(body: string, targetKey: string): Promise<void> {
    this.logger.log(`SMS [${targetKey}] ${body}`);
  }
}
