import { z } from 'zod';

export const EstadoGuardiaSchema = z.enum(['PENDIENTE', 'EN_CURSO', 'COMPLETADA', 'INASISTENCIA', 'CANCELADA']);

export const GuardiaSchema = z.object({
  id: z.string().optional(),
  bomberoId: z.string().min(1, "Debe seleccionar un bombero"),
  bomberoNombre: z.string().optional(), // Denormalización para facilitar vistas
  fechaInicio: z.date({
    required_error: "La fecha de inicio es requerida",
  }).or(z.string().min(1, "La fecha de inicio es requerida")).or(z.any()), // Permitir varios formatos para flexibilidad con Firebase
  fechaFin: z.date({
    required_error: "La fecha de fin es requerida",
  }).or(z.string().min(1, "La fecha de fin es requerida")).or(z.any()),
  estado: EstadoGuardiaSchema.default('PENDIENTE'),
  observaciones: z.string().optional(),
  creadoPor: z.string().optional(),
  fechaCreacion: z.any().optional(),
  fechaActualizacion: z.any().optional(),
  notificadoRecordatorio: z.boolean().default(false).optional(),
  notificadoRetraso: z.boolean().default(false).optional(),
  notificadoRetrasoGrave: z.boolean().default(false).optional(),
  notificadoFinSinMarcar: z.boolean().default(false).optional(),
});
