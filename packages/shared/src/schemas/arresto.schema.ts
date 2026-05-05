import { z } from 'zod';

export const TipoArrestoSchema = z.enum(['INFRACCION', 'PAGO']);
export const EstadoArrestoSchema = z.enum(['PENDIENTE_PAGO', 'PENDIENTE_VALIDACION', 'PAGADO', 'RECHAZADO']);
export const SedeSchema = z.enum(['SARTENEJAS', 'LITORAL']);
export const TurnoSchema = z.string();

export const ArrestoSchema = z.object({
    id: z.string().optional(),
    bomberoId: z.string({ required_error: "El ID del bombero es requerido" }),
    bomberoNombre: z.string().optional(),
    tipo: TipoArrestoSchema,
    estado: EstadoArrestoSchema.default('PENDIENTE_PAGO'),
    minutos: z.number().min(1, "La cantidad mínima es de 1 minuto"),
    
    // Campos Comunes
    fecha: z.any(), // Fecha de inicio de la guardia / fecha en la que ocurrió
    turno: TurnoSchema.optional(),
    numeroParte: z.string().optional(),
    sede: z.preprocess((val) => (val === '' ? undefined : val), SedeSchema.optional()),

    // Campos de Infracción (Regular e Irregular)
    falta: z.preprocess((val) => (val === '' ? undefined : val), z.enum(['LLEGADA_TARDE', 'INASISTENCIA']).optional()),
    notifico: z.boolean().optional(),
    motivo: z.string().optional(),
    mesInasistencia: z.string().optional(), // Para los No Regulares

    // Campos de Pago
    pagoDoble: z.boolean().optional(),
    observaciones: z.string().optional(),

    // Auditoría
    fechaRegistro: z.any().optional(),
    registradoPor: z.string().optional(), // Quien inserta el arresto
    registradoPorNombre: z.string().optional(),
    revisadoPor: z.string().optional(),
    notasRevision: z.string().optional(),
    parentArrestoId: z.string().optional(), // ID de la infracción que se está pagando
});
