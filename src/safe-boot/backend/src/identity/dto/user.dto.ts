/**
 * User DTOs for identity management.
 */

import { IsString, IsEmail, IsNumber, IsOptional, Length, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';

export enum UserRoleEnum {
  SUPERADMIN = 'superadmin',
  ADMIN = 'admin',
  TREASURER = 'treasurer',
  PASTOR = 'pastor',
  STAFF = 'staff',
}

export class CreateUserDTO {
  @IsEnum(UserRoleEnum, { message: 'Le rôle doit être un rôle valide' })
  role: UserRoleEnum;

  @IsString({ message: 'Le prénom est requis' })
  @Length(1, 100, { message: 'Le prénom doit avoir entre 1 et 100 caractères' })
  firstName: string;

  @IsString({ message: 'Le nom est requis' })
  @Length(1, 100, { message: 'Le nom doit avoir entre 1 et 100 caractères' })
  lastName: string;

  @IsEmail({}, { message: 'L\'email est requis et doit être valide' })
  email: string;

  @IsOptional()
  @IsString({ message: 'Le téléphone doit être une chaîne' })
  @Length(1, 20, { message: 'Le téléphone doit avoir entre 1 et 20 caractères' })
  phone?: string;

  @IsOptional()
  @IsString()
  avatarUrl?: string;
}

export class UpdateUserDTO {
  @IsOptional()
  @IsEnum(UserRoleEnum, { message: 'Le rôle doit être un rôle valide' })
  role?: UserRoleEnum;

  @IsOptional()
  @IsString({ message: 'Le prénom doit être une chaîne' })
  @Length(1, 100, { message: 'Le prénom doit avoir entre 1 et 100 caractères' })
  firstName?: string;

  @IsOptional()
  @IsString({ message: 'Le nom doit être une chaîne' })
  @Length(1, 100, { message: 'Le nom doit avoir entre 1 et 100 caractères' })
  lastName?: string;

  @IsOptional()
  @IsEmail({}, { message: 'L\'email doit être valide' })
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  avatarUrl?: string;
}

export class UserSummaryDTO {
  id: number;

  @IsString()
  firstName: string;

  @IsString()
  lastName: string;

  @IsString()
  email: string;

  @IsEnum(UserRoleEnum)
  role: UserRoleEnum;

  @IsOptional()
  @IsString()
  avatarUrl?: string;

  @IsNumber()
  organizationId: number;
}
