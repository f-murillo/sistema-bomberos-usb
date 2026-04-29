import { z } from 'zod';
import {RolSchema , UsuarioSchema} from '../schemas/usuario.schema';

// Tipos del rol, del usuario, y para la creacion de usuarios
export type Rol = z.infer<typeof RolSchema>;
export type Usuario = z.infer<typeof UsuarioSchema>;
export type CreateUsuarioInput = z.infer<typeof UsuarioSchema>;