import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @IsString()
  @IsNotEmpty()
  identifier: string; // Can be email or display_name

  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  password: string;
}

