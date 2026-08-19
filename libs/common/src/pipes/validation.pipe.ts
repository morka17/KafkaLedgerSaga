import { ArgumentMetadata, BadRequestException, Injectable, PipeTransform } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

/**
 * Validates every incoming DTO (HTTP body AND Kafka message payload)
 * against its class-validator decorators before it ever reaches a
 * handler. Applied globally in each service's main.ts.
 */
@Injectable()
export class ValidationPipe implements PipeTransform<unknown> {
  async transform(value: unknown, { metatype }: ArgumentMetadata) {
    if (!metatype || !this.shouldValidate(metatype)) {
      return value;
    }

    const object = plainToInstance(metatype, value);
    const errors = await validate(object as object, { whitelist: true, forbidNonWhitelisted: true });

    if (errors.length > 0) {
      const formatted = errors.map((e) => ({
        property: e.property,
        constraints: e.constraints,
      }));
      throw new BadRequestException({ message: 'Validation failed', errors: formatted });
    }

    return object;
  }

  private shouldValidate(metatype: new (...args: unknown[]) => unknown): boolean {
    const primitives: unknown[] = [String, Boolean, Number, Array, Object];
    return !primitives.includes(metatype);
  }
}
