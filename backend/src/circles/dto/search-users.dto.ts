import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class SearchUsersDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  query: string;
}

