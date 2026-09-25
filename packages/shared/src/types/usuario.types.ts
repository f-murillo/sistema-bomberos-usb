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

// Tipos de límites configurables (guardados en Firestore en configuracion/limites_condicion)
export type LimitesCondicion = Partial<Record<Condicion, { maxMinutosArresto: number }>>;

/**
 * Resuelve las reglas de una condición aplicando los límites configurables
 * (si existen) sobre los valores por defecto de REGLAS_CONDICION.
 * Único punto de verdad para obtener el límite vigente de un bombero.
 */
export const resolverReglasCondicion = (
    condicion: string | undefined,
    limites?: LimitesCondicion | null
): { horasMensuales: number; maxMinutosArresto: number } => {
    const key: Condicion = (condicion && condicion in REGLAS_CONDICION ? condicion : 'REGULAR') as Condicion;
    const base = REGLAS_CONDICION[key];
    const custom = limites?.[key]?.maxMinutosArresto;
    return typeof custom === 'number' ? { ...base, maxMinutosArresto: custom } : base;
};