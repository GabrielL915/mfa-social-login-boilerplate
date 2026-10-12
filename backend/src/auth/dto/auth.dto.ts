import { IsEmail, IsString, Length, MinLength } from 'class-validator';

export class RegisterDto {
  @IsEmail() email: string;
  @MinLength(8) password: string;
  @IsString() name: string;
}

export class LoginDto {
  @IsEmail() email: string;
  @IsString() password: string;
}

export class MfaCodeDto {
  @IsString() @Length(6, 6) code: string;
}

export class MfaLoginDto {
  @IsString() mfaToken: string;
  @IsString() code: string; // TOTP de 6 digitos ou recovery code
}
