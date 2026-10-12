import { IsEmail, IsString, Length, MinLength } from 'class-validator';

export class RegisterDto {
  @IsString() cpf: string;
  @IsEmail() email: string;
  @MinLength(8) password: string;
  @IsString() name: string;
}

export class LoginDto {
  @IsString() cpf: string;
  @IsString() password: string;
}

export class MfaCodeDto {
  @IsString() @Length(6, 6) code: string;
}

export class MfaLoginDto {
  @IsString() mfaToken: string;
  @IsString() code: string; // TOTP de 6 digitos ou recovery code
}

/** Usuario veio de social/SSO sem CPF: completa o cadastro. */
export class CompleteProfileDto {
  @IsString() profileToken: string;
  @IsString() cpf: string;
}

/** CPF ja pertence a outra conta: prova a senha dela pra vincular o login social. */
export class LinkAccountDto {
  @IsString() profileToken: string;
  @IsString() cpf: string;
  @IsString() password: string;
}
