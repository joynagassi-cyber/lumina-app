/**
 * Login DTO for authentication endpoint.
 */

import { IsEmail, IsString, Length, IsOptional, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';

export class LoginInputDTO {
  @IsEmail({}, { message: 'L\'email est requis et doit être valide' })
  email: string;

  @IsString({ message: 'Le mot de passe est requis' })
  @Length(8, 255, { message: 'Le mot de passe doit avoir entre 8 et 255 caractères' })
  password: string;

  @IsOptional()
  @IsNumber({ message: 'L\'ID d\'organisation doit être un nombre' })
  organizationId?: number;
}

export class LoginResponseDTO {
  userId: number;
  roleId: string; // e.g., 'admin', 'editor', etc.
  accessToken: string;
  refreshToken: string;
  expiresIn: number; // seconds
  organizationId?: number;
  profile: {
    id: number;
    firstName: string;
    lastName: string;
    email: string;
    avatarUrl?: string;
  };
}
