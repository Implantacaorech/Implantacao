import { SetMetadata } from '@nestjs/common';
import { Perfil } from '../constants/perfis';

export const ROLES_KEY = 'roles';
/** Equivale ao conjunto de perfis autorizados em pode_ver/pode_gerar/pode_designar do Flask. */
export const Roles = (...roles: Perfil[]) => SetMetadata(ROLES_KEY, roles);
