import { IsBoolean, IsNotEmpty } from 'class-validator';

export class UpdateAvailabilityDto {
  @IsBoolean()
  @IsNotEmpty()
  is_available: boolean;
}

