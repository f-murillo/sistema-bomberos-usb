import { z } from 'zod';
import { GuardiaSchema, EstadoGuardiaSchema } from '../schemas/guardia.schema.js';

export type EstadoGuardia = z.infer<typeof EstadoGuardiaSchema>;
export type Guardia = z.infer<typeof GuardiaSchema>;
