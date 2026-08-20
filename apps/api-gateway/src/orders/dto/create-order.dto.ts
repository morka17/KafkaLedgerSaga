import { IsArray, IsNumber, IsPositive, IsString, ValidateNested, ArrayMinSize } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * Note: customerId is deliberately NOT a field here. It comes from the
 * authenticated JWT via @CurrentUser(), never from client-supplied body -
 * otherwise any authenticated user could place orders on another
 * customer's behalf just by editing the request body.
 */
export class CreateOrderItemDto {
  @IsString()
  sku!: string;

  @IsNumber()
  @IsPositive()
  qty!: number;

  @IsNumber()
  @IsPositive()
  unitPriceCents!: number;
}

export class CreateOrderDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateOrderItemDto)
  items!: CreateOrderItemDto[];
}
