import { Request, Response } from "express";
import { ActualizarLimitesSchema, REGLAS_CONDICION } from "@bomberos-usb/shared";
import { db } from "../../config/firebase";
import { registrarAuditoria } from "../../utils/auditoria";

const COLECCION = "configuracion";
const DOC_LIMITES = "limites_condicion";

// Devuelve los límites vigentes por condición (configurados + por defecto)
export const obtenerLimites = async (req: Request, res: Response) => {
    try {
        const doc = await db.collection(COLECCION).doc(DOC_LIMITES).get();
        const data = doc.exists ? doc.data()! : {};
        const guardados = data.limites || {};

        // Completamos con los valores por defecto las condiciones que no estén configuradas
        const limites: Record<string, { maxMinutosArresto: number }> = {};
        (Object.keys(REGLAS_CONDICION) as (keyof typeof REGLAS_CONDICION)[]).forEach((cond) => {
            const guardado = guardados[cond]?.maxMinutosArresto;
            limites[cond] = {
                maxMinutosArresto: typeof guardado === "number" ? guardado : REGLAS_CONDICION[cond].maxMinutosArresto
            };
        });

        res.status(200).json({
            limites,
            actualizadoPor: data.actualizadoPor,
            actualizadoPorNombre: data.actualizadoPorNombre,
            fechaActualizacion: data.fechaActualizacion?.toDate
                ? data.fechaActualizacion.toDate()
                : data.fechaActualizacion
        });
    } catch (error: any) {
        console.error("Error al obtener límites:", error);
        res.status(500).json({ message: "Error al obtener los límites de minutos" });
    }
};

// Actualiza los límites de minutos por condición (solo Inspector General / Cuenta Administrativa)
export const actualizarLimites = async (req: Request, res: Response) => {
    try {
        // safeParse en lugar de .parse() + instanceof ZodError: el schema vive en
        // @bomberos-usb/shared y ambas cargas de zod pueden no compartir clase,
        // lo que haría que la validación cayera en el catch y devolviera 500
        const resultado = ActualizarLimitesSchema.safeParse(req.body);
        if (!resultado.success) {
            const detalle = resultado.error.issues
                .map((i) => `${i.path.length ? i.path.join(".") + ": " : ""}${i.message}`)
                .join(" | ");
            return res.status(400).json({
                message: `Límites inválidos: ${detalle}`,
                errors: resultado.error.flatten()
            });
        }
        const validated = resultado.data;
        const requestingUser = (req as any).user;

        const docRef = db.collection(COLECCION).doc(DOC_LIMITES);
        const doc = await docRef.get();
        const anteriores = doc.exists ? (doc.data()!.limites || {}) : {};

        // Fusionamos lo enviado con lo ya guardado (lo no enviado conserva su valor)
        const limites: Record<string, { maxMinutosArresto: number }> = {};
        (Object.keys(REGLAS_CONDICION) as (keyof typeof REGLAS_CONDICION)[]).forEach((cond) => {
            const nuevo = validated.limites[cond]?.maxMinutosArresto;
            const actual = anteriores[cond]?.maxMinutosArresto;
            limites[cond] = {
                maxMinutosArresto: typeof nuevo === "number"
                    ? nuevo
                    : (typeof actual === "number" ? actual : REGLAS_CONDICION[cond].maxMinutosArresto)
            };
        });

        await docRef.set({
            limites,
            actualizadoPor: requestingUser.uid || "SISTEMA",
            actualizadoPorNombre: requestingUser.name || requestingUser.email || requestingUser.uid || "SISTEMA",
            fechaActualizacion: new Date()
        });

        // Auditoría: qué cambió y de cuánto a cuánto
        const cambios: Record<string, { de: number; a: number }> = {};
        Object.keys(limites).forEach((cond) => {
            const antes = typeof anteriores[cond]?.maxMinutosArresto === "number"
                ? anteriores[cond].maxMinutosArresto
                : REGLAS_CONDICION[cond as keyof typeof REGLAS_CONDICION].maxMinutosArresto;
            const ahora = limites[cond].maxMinutosArresto;
            if (antes !== ahora) cambios[cond] = { de: antes, a: ahora };
        });

        await registrarAuditoria(
            'ACTUALIZAR_LIMITES',
            COLECCION,
            DOC_LIMITES,
            requestingUser.uid || "SISTEMA",
            { cambios, limites }
        );

        res.status(200).json({
            message: "Límites actualizados exitosamente",
            limites,
            cambios
        });
    } catch (error: any) {
        console.error("Error al actualizar límites:", error);
        res.status(500).json({ message: "Error interno al actualizar los límites" });
    }
};
