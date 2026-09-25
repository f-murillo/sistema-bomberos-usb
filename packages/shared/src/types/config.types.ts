import { z } from 'zod';
import { Condicion } from './usuario.types';
import { ActualizarLimitesSchema } from '../schemas/config.schema';

export type ActualizarLimitesInput = z.infer<typeof ActualizarLimitesSchema>;

// Respuesta del endpoint GET /config/limites (límites ya completados con los defaults)
export interface LimitesResponse {
    limites: Record<Condicion, { maxMinutosArresto: number }>;
    actualizadoPor?: string;
    actualizadoPorNombre?: string;
    fechaActualizacion?: string;
}
