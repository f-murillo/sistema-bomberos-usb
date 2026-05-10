import { z } from 'zod';

// Esquema de los roles de los usuarios
export const RolSchema = z.enum(['ADMIN', 'SUPERVISOR', 'BOMBERO']);

export const RangoSchema = z.enum([
    'ASP/ALUM',
    'BOMBERO_RASO',
    'CABO_PRIMERO',
    'CABO_SEGUNDO',
    'SARGENTO_PRIMERO',
    'SARGENTO_SEGUNDO',
    'SARGENTO_MAYOR',
    'TENIENTE',
    'CAPITAN',
    'DISTINGUIDO'
]);

export const CondicionSchema = z.enum([
    'REGULAR',
    'TESISTA',
    'COMANDANTE',
    'EX_COMANDANTE',
    'EGRESADO',
    'ESPECIAL_12H'
]);
 
// Esquema del usuario
export const UsuarioSchema = z.object({
    uid: z.string().optional(), // Este sera el ID que genere el Firebase Auth
    nombre: z.string().min(2, "El nombre es demasiado corto")
    .max(100, "El nombre es demasiado largo"),
    email: z.string().email("El correo electrónico debe ser válido"),
    rol: RolSchema,
    activo: z.boolean().default(true),
    telefono: z.string()
        .regex(/^(0414|0424|0412|0422|0416|0426)\d{7}$/, "El formato del teléfono debe ser válido (Ej: 04241234567)")
        .optional()
        .or(z.literal("")),
    fcmToken: z.string().optional(), // Para poder enviar las notificaciones
    creadoPor: z.string().optional(), // Para llevar control
    fechaRegistro: z.any().optional(), // Flexible para evitar errores de validación Date/String
    fechaActualizacion: z.any().optional(), // Flexible para auditoría
    minutosArresto: z.number().default(0), // Contador de minutos de arresto/trabajo pendientes
    rango: RangoSchema.optional(), // Jerarquía del bombero
    condicion: CondicionSchema.default('REGULAR') // Condición del bombero
});

// Esquema para el cambio de contraseña
export const PasswordChangeSchema = z.object({
    currentPassword: z.string().min(1, "La contraseña actual es requerida"),
    newPassword: z.string().min(6, "La nueva contraseña debe tener al menos 6 caracteres"),
    confirmPassword: z.string().min(1, "Debes confirmar la nueva contraseña"),
}).refine((data) => data.newPassword === data.confirmPassword, {
    message: "Las contraseñas no coinciden",
    path: ["confirmPassword"],
});
