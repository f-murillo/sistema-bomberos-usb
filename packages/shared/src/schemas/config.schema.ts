import { z } from 'zod';

// Regla mínima editable por condición: solo el límite de minutos de arresto
const ReglaLimiteSchema = z.object({
    maxMinutosArresto: z.number({
        required_error: "El límite es requerido",
        invalid_type_error: "El límite debe ser un número"
    })
        .int("El límite debe ser un número entero de minutos")
        .min(1, "El límite debe ser mayor a 0 minutos")
        .max(525600, "El límite no puede exceder 525600 minutos (1 año)")
});

// Esquema para actualizar los límites por condición (todos los campos son opcionales:
// lo que no se envíe conserva su valor actual / por defecto)
export const ActualizarLimitesSchema = z.object({
    limites: z.object({
        REGULAR: ReglaLimiteSchema.optional(),
        TESISTA: ReglaLimiteSchema.optional(),
        COMANDANTE: ReglaLimiteSchema.optional(),
        EX_COMANDANTE: ReglaLimiteSchema.optional(),
        EGRESADO: ReglaLimiteSchema.optional(),
        ESPECIAL_12H: ReglaLimiteSchema.optional(),
    })
        // .strict(): una condición desconocida debe rechazarse (400) y no
        // descartarse en silencio, o un error de tipeo no se notificaría nunca
        .strict()
});
