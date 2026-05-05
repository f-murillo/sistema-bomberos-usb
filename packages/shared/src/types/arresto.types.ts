import { z } from 'zod';
import { ArrestoSchema, TipoArrestoSchema, EstadoArrestoSchema, SedeSchema, TurnoSchema } from '../schemas/arresto.schema';

export type Arresto = z.infer<typeof ArrestoSchema>;
export type TipoArresto = z.infer<typeof TipoArrestoSchema>;
export type EstadoArresto = z.infer<typeof EstadoArrestoSchema>;
export type Sede = z.infer<typeof SedeSchema>;
export type Turno = z.infer<typeof TurnoSchema>;
