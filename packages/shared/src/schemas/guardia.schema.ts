import { z } from 'zod';

export const EstadoGuardiaSchema = z.enum(['PENDIENTE', 'COMPLETADA', 'INASISTENCIA', 'CANCELADA']);
export const SedeGuardiaSchema = z.enum(['SARTENEJAS', 'LITORAL']);

export const GuardiaSchema = z.object({
  id: z.string().optional(),
  bomberoId: z.string().min(1, "Debe seleccionar un bombero"),
  bomberoNombre: z.string().optional(), // Denormalización para facilitar vistas
  fecha: z.any(), // Fecha de la guardia
  turno: z.string().min(1, "El turno es requerido"),
  minutos: z.number().min(1, "La duración de la guardia debe ser mayor a 0"),
  minutosEfectivos: z.number().optional(),
  sede: z.preprocess((val) => (val === '' ? undefined : val), SedeGuardiaSchema.optional()),
  numeroParte: z.string().optional(),
  estado: EstadoGuardiaSchema.default('PENDIENTE'),
  observaciones: z.string().optional(),
  creadoPor: z.string().optional(),
  creadoPorNombre: z.string().optional(),
  fechaCreacion: z.any().optional(),
  fechaActualizacion: z.any().optional(),
  notificadoRecordatorio: z.boolean().default(false).optional()
});
