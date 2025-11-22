import { IsEnum, IsNotEmpty, IsUUID } from 'class-validator';

export enum InvitationResponse {
  ACCEPT = 'accept',
  DECLINE = 'decline',
}

export class RespondInvitationDto {
  @IsUUID()
  @IsNotEmpty()
  invitationId: string;

  @IsEnum(InvitationResponse)
  @IsNotEmpty()
  response: InvitationResponse;
}

