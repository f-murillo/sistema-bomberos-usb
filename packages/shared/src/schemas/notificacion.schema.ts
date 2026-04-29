import { z } from 'zod';

export const TipoNotificacionSchema = z.enum(['INFO', 'ALERTA', 'EXITO', 'SISTEMA']);

export const NotificacionSchema = z.object({
  id: z.string().optional(),
  usuarioId: z.string({
    required_error: "El ID del destinatario es requerido",
  }),
  titulo: z.string().min(3, "El título es demasiado corto"),
  mensaje: z.string().min(5, "El mensaje es demasiado corto"),
  leida: z.boolean().default(false),
  tipo: TipoNotificacionSchema.default('INFO'),
  link: z.string().optional(),
  fechaCreacion: z.any().optional(),
});
