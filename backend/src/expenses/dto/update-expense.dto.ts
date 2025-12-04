import {
  IsArray,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { SplitType, ExpenseSplitDto } from './create-expense.dto';

export class UpdateExpenseDto {
  @IsString()
  @IsOptional()
  @MaxLength(255)
  title?: string;

  @IsNumber()
  @IsOptional()
  @Min(0.01)
  amount?: number;

  @IsUUID()
  @IsOptional()
  paid_by?: string;

  @IsEnum(SplitType)
  @IsOptional()
  split_type?: SplitType;

  @IsArray()
  @IsUUID('4', { each: true })
  @IsOptional()
  attendee_ids?: string[];

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
