import { IsEnum, IsNotEmpty } from 'class-validator';

export enum RSVPStatus {
  GOING = 'going',
  NOT_GOING = 'not_going',
}

export class RSVPDto {
  @IsEnum(RSVPStatus)
  @IsNotEmpty()
  status: RSVPStatus;
}
