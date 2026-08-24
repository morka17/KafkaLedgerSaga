import { Injectable, Logger } from '@nestjs/common';

export interface CustomerContact {
  email: string;
  phone?: string;
}

/**
 * HONEST GAP: order/payment/inventory events only ever carry a
 * `customerId` (a UUID) - nothing in this system's event contracts
 * carries an email address or phone number, because there is no
 * customer-profile/identity service in this architecture to be the
 * source of truth for that data.
 *
 * In a real deployment, this resolver would call that service (or read
 * a denormalized customer-contact projection kept in sync via its own
 * events) instead of fabricating an address. Until that service exists,
 * this derives a placeholder address deterministically from the id so
 * the rest of the pipeline (templates, provider calls, logging) is
 * fully exercisable in dev/CI - it is NOT something to point at real
 * SendGrid/Twilio credentials in production.
 */
@Injectable()
export class CustomerContactResolver {
  private readonly logger = new Logger(CustomerContactResolver.name);

  async resolve(customerId: string): Promise<CustomerContact> {
    this.logger.warn(
      `No customer directory is wired up - deriving a placeholder contact for ${customerId}. ` +
        `Replace CustomerContactResolver with a real lookup before sending real notifications.`,
    );
    return { email: `${customerId}@customers.saganova.example` };
  }
}
