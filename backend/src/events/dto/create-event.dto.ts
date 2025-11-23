import {
  IsDateString,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateEventDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title: string;

  @IsDateString()
  @IsNotEmpty()
  date_time: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  location: string;

  @IsString()
  @IsOptional()
  @MaxLength(1000)
  description?: string;
}
