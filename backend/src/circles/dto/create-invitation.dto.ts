import { IsNotEmpty, IsUUID } from 'class-validator';

export class CreateInvitationDto {
  @IsUUID()
  @IsNotEmpty()
  circleId: string;

  @IsUUID()
  @IsNotEmpty()
  inviteeId: string;
}

