import { z } from 'zod';
import { NotificacionSchema, TipoNotificacionSchema } from '../schemas/notificacion.schema.js';

export type Notificacion = z.infer<typeof NotificacionSchema>;
export type TipoNotificacion = z.infer<typeof TipoNotificacionSchema>;
