import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsInt,
  IsNotEmpty,
  Max,
  Min,
  ValidateIf,
} from 'class-validator';
import { IsDateRangeValid } from './date-range-validator';

export class CreateAvailabilityDto {
  @IsDateString()
  @IsNotEmpty()
  start_date: string;

  @IsDateString()
  @IsNotEmpty()
  @IsDateRangeValid()
  end_date: string;

  @IsArray()
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(23, { each: true })
  @IsNotEmpty()
  hour_blocks: number[];

  @IsBoolean()
  @ValidateIf((o) => o.is_available !== undefined)
  is_available?: boolean;
}

