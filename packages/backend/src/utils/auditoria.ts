import { db } from "../config/firebase";

export const registrarAuditoria = async (
    accion: 'CREAR_USUARIO' | 'ACTUALIZAR_USUARIO' | 'ELIMINAR_USUARIO' | 'CAMBIAR_PASSWORD' | 'SOLICITAR_RESET_PASSWORD' | 'CREAR_GUARDIA' | 'ACTUALIZAR_GUARDIA' | 'ELIMINAR_GUARDIA' | 'INICIAR_GUARDIA' | 'COMPLETAR_GUARDIA' | 'CANCELAR_GUARDIA' | 'INASISTENCIA_GUARDIA' | 'ELIMINAR_LOGS' | 'REGISTRAR_INFRACCION' | 'REPORTAR_PAGO_ARRESTO' | 'REVISAR_PAGO_ARRESTO' | 'EDITAR_ARRESTO' | 'ELIMINAR_ARRESTO',
    coleccion: string,
    documentoId: string,
    realizadoPor: string,
    detalles?: any
) => {
    try {
        const now = new Date();
        const expiresAt = new Date();
        expiresAt.setMonth(now.getMonth() + 3); // Expira en 3 meses

        await db.collection("auditoria").add({
            accion,
            coleccion,
            documentoId,
            realizadoPor,
            detalles,
            timestamp: now,
            expiresAt: expiresAt
        });
    } catch (error) {
        console.error("Error al registrar auditoría:", error);
    }
};
