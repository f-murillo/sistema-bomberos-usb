import { z } from 'zod';
import {RolSchema , UsuarioSchema, RangoSchema, CondicionSchema} from '../schemas/usuario.schema';

// Tipos del rol, del usuario, y para la creacion de usuarios
export type Rol = z.infer<typeof RolSchema>;
export type Rango = z.infer<typeof RangoSchema>;
export type Condicion = z.infer<typeof CondicionSchema>;
export type Usuario = z.infer<typeof UsuarioSchema>;
export type CreateUsuarioInput = z.infer<typeof UsuarioSchema>;

export const REGLAS_CONDICION: Record<Condicion, { horasMensuales: number; maxMinutosArresto: number }> = {
    'REGULAR': { horasMensuales: 24, maxMinutosArresto: 11520 },
    'TESISTA': { horasMensuales: 12, maxMinutosArresto: 5760 },
    'COMANDANTE': { horasMensuales: 24, maxMinutosArresto: 11520 },
    'EX_COMANDANTE': { horasMensuales: 16, maxMinutosArresto: 7680 },
    'EGRESADO': { horasMensuales: 8, maxMinutosArresto: 3840 },
    'ESPECIAL_12H': { horasMensuales: 12, maxMinutosArresto: 5760 },
};