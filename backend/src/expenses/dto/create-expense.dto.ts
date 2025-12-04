import {
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum SplitType {
  EQUAL = 'equal',
  INDIVIDUAL = 'individual',
  CUSTOM = 'custom',
}

export class ExpenseSplitDto {
  @IsUUID()
  @IsNotEmpty()
  user_id: string;

  @IsNumber()
  @Min(0)
  amount_owed: number;
}

export class CreateExpenseDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title: string;

  @IsNumber()
  @Min(0.01)
  amount: number;

  @IsUUID()
  @IsNotEmpty()
  paid_by: string;

  @IsEnum(SplitType)
  @IsNotEmpty()
  split_type: SplitType;

  @IsArray()
  @IsUUID('4', { each: true })
  @IsNotEmpty()
  attendee_ids: string[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ExpenseSplitDto)
  @IsOptional()
  custom_splits?: ExpenseSplitDto[];

  @IsString()
  @IsOptional()
  @MaxLength(1000)
  description?: string;
}
