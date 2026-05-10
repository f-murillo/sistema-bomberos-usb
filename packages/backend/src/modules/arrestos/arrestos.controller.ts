import { Request, Response } from "express";
import { ZodError } from "zod";
import { format } from "date-fns";
import { ArrestoSchema } from "@bomberos-usb/shared"; // This will be available after build
import { db as firestore } from "../../config/firebase";
import { registrarAuditoria } from "../../utils/auditoria";
import { NotificacionService } from "../notificaciones/notificaciones.service";
import { EmailService } from "../notificaciones/email.service";

export const registrarInfraccion = async (req: Request, res: Response) => {
    try {
        console.log("Datos recibidos para infracción:", req.body);
        const validatedData = ArrestoSchema.parse({
            ...req.body,
            tipo: 'INFRACCION',
            estado: 'PENDIENTE_PAGO',
            fechaRegistro: new Date()
        });

        const supervisorId = (req as any).user.uid;
        
        // Un bombero no puede meterse un arresto a sí mismo
        if (validatedData.bomberoId === supervisorId) {
            return res.status(403).json({ message: "No puedes registrarte una infracción a ti mismo." });
        }

        // Usamos una transacción para asegurar consistencia entre el registro y el balance del usuario
        await firestore.runTransaction(async (transaction) => {
            const userRef = firestore.collection("usuarios").doc(validatedData.bomberoId);
            const supervisorRef = firestore.collection("usuarios").doc(supervisorId);
            
            const [userDoc, supervisorDoc] = await Promise.all([
                transaction.get(userRef),
                transaction.get(supervisorRef)
            ]);

            if (!userDoc.exists) {
                throw new Error("El bombero no existe");
            }

            const userData = userDoc.data();
            const supervisorData = supervisorDoc.data();
            const nuevoBalance = (userData?.minutosArresto || 0) + (validatedData.minutos || 0);

            // Obtener nombres para que queden en el registro denormalizado
            const bomberoNombre = userData?.nombre || "Bombero";
            const registradoPorNombre = supervisorData?.nombre || (req as any).user.nombre || "Compañero";

            // 1. Crear el registro en el historial
            const arrestoRef = firestore.collection("registro_arrestos").doc();
            transaction.set(arrestoRef, {
                ...validatedData,
                bomberoNombre,
                registradoPor: supervisorId,
                registradoPorNombre,
                fecha: new Date(validatedData.fecha)
            });

            // 2. Actualizar el balance del usuario
            transaction.update(userRef, {
                minutosArresto: nuevoBalance,
                fechaActualizacion: new Date()
            });
        });

        await registrarAuditoria('REGISTRAR_INFRACCION', 'registro_arrestos', validatedData.bomberoId, supervisorId, { minutos: validatedData.minutos });

        // Obtener el nombre del que reporta para la notificación
        const reportadorDoc = await firestore.collection("usuarios").doc(supervisorId).get();
        const nombreReportador = reportadorDoc.data()?.nombre || "Un compañero";

        // Notificar al bombero
        await NotificacionService.enviar({
            usuarioId: validatedData.bomberoId,
            titulo: "🚨 Nueva infracción reportada",
            mensaje: `${nombreReportador} te ha asignado ${validatedData.minutos} minutos de arresto. Motivo: ${validatedData.motivo || validatedData.falta || 'No especificado'}`,
            tipo: "ALERTA",
            link: "/arrestos"
        });

        // Enviar correos electrónicos (en segundo plano)
        (async () => {
            try {
                const infractorDoc = await firestore.collection("usuarios").doc(validatedData.bomberoId).get();
                const infractorEmail = infractorDoc.data()?.email;
                const registradorEmail = (req as any).user.email || reportadorDoc.data()?.email;
                
                const supervisorsSnapshot = await firestore.collection("usuarios").where("rol", "==", "SUPERVISOR").get();
                const supervisorEmails = supervisorsSnapshot.docs.map(doc => doc.data().email).filter(e => !!e);

                const destinatarios = new Set<string>();
                if (infractorEmail) destinatarios.add(infractorEmail);
                if (registradorEmail) destinatarios.add(registradorEmail);
                supervisorEmails.forEach(e => destinatarios.add(e));

                if (destinatarios.size > 0) {
                    await EmailService.enviarNotificacionArresto({
                        destinatarioEmail: Array.from(destinatarios),
                        bomberoNombre: infractorDoc.data()?.nombre || "Bombero",
                        registradoPorNombre: nombreReportador,
                        minutos: validatedData.minutos,
                        motivo: validatedData.motivo || validatedData.falta || 'No especificado',
                        fecha: format(new Date(validatedData.fecha), 'dd/MM/yyyy')
                    });
                }
            } catch (err) {
                console.error("Error en el envío de correos de infracción:", err);
            }
        })();

        res.status(201).json({ message: "Infracción registrada y balance actualizado" });

    } catch (error: any) {
        if (error instanceof ZodError) {
            return res.status(400).json({ errors: error.flatten() });
        }
        console.error("Error al registrar infracción:", error);
        res.status(500).json({ message: error.message || "Error interno del servidor" });
    }
};

export const reportarPago = async (req: Request, res: Response) => {
    try {
        const user = (req as any).user;
        const registradoPor = user.uid;
        const registradoPorNombre = user.nombre || "Usuario";
        
        // El bombero objetivo puede venir en el body o ser el mismo usuario
        const esSuperior = user.rol === 'SUPERVISOR' || user.rol === 'ADMIN';
        const bomberoId = (esSuperior && req.body.bomberoId) ? req.body.bomberoId : registradoPor;
        
        const validatedData = ArrestoSchema.parse({
            ...req.body,
            bomberoId,
            tipo: 'PAGO',
            estado: 'PAGADO', // Auto-aprobar siempre
            fechaRegistro: new Date()
        });

        const minutosEfectivos = validatedData.pagoDoble ? validatedData.minutos * 2 : validatedData.minutos;
        const arrestoRef = firestore.collection("registro_arrestos").doc();

        let bomberoNombre = "Bombero";

        await firestore.runTransaction(async (transaction) => {
            const userRef = firestore.collection("usuarios").doc(bomberoId);
            const userDoc = await transaction.get(userRef);
            
            if (userDoc.exists) {
                const userData = userDoc.data();
                bomberoNombre = userData?.nombre || "Bombero";
                const nuevoBalance = Math.max(0, (userData?.minutosArresto || 0) - minutosEfectivos);
                transaction.update(userRef, { minutosArresto: nuevoBalance });
            }

            transaction.set(arrestoRef, {
                ...validatedData,
                bomberoNombre,
                registradoPor,
                registradoPorNombre,
                fecha: new Date(validatedData.fecha)
            });
        });

        await registrarAuditoria('REPORTAR_PAGO_ARRESTO', 'registro_arrestos', arrestoRef.id, registradoPor, { minutos: validatedData.minutos, bomberoId });

        // Si fue asignado por otra persona, notificar al bombero
        if (bomberoId !== registradoPor) {
            await NotificacionService.enviar({
                usuarioId: bomberoId,
                titulo: "📋 Pago de arresto registrado",
                mensaje: `${registradoPorNombre} ha registrado un pago de ${validatedData.minutos} minutos a tu nombre. Motivo: ${validatedData.motivo || 'No especificado'}`,
                tipo: "INFO",
                link: "/arrestos"
            });
        }

        // Enviar correos electrónicos (en segundo plano)
        (async () => {
            try {
                const bomberoDoc = await firestore.collection("usuarios").doc(bomberoId).get();
                const bomberoEmail = bomberoDoc.data()?.email;
                
                const supervisorsSnapshot = await firestore.collection("usuarios").where("rol", "==", "SUPERVISOR").get();
                const supervisorEmails = supervisorsSnapshot.docs.map(doc => doc.data().email).filter(e => !!e);

                const destinatarios = new Set<string>();
                if (bomberoEmail) destinatarios.add(bomberoEmail);
                supervisorEmails.forEach(e => destinatarios.add(e));

                if (destinatarios.size > 0) {
                    await EmailService.enviarNotificacionPago({
                        destinatarioEmail: Array.from(destinatarios),
                        bomberoNombre: bomberoDoc.data()?.nombre || "Bombero",
                        minutos: validatedData.minutos,
                        pagoDoble: validatedData.pagoDoble,
                        motivo: validatedData.motivo || 'No especificado',
                        fecha: format(new Date(validatedData.fecha), 'dd/MM/yyyy')
                    });
                }
            } catch (err) {
                console.error("Error en el envío de correos de pago:", err);
            }
        })();

        res.status(201).json({ 
            message: "Pago reportado y procesado exitosamente.", 
            id: arrestoRef.id 
        });

    } catch (error: any) {
        if (error instanceof ZodError) {
            return res.status(400).json({ errors: error.flatten() });
        }
        console.error("Error al reportar pago:", error);
        res.status(500).json({ message: error.message || "Error interno del servidor" });
    }
};

export const revisarPago = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { estado, notasRevision } = req.body;
        const supervisorId = (req as any).user.uid;

        if (!['PAGADO', 'RECHAZADO'].includes(estado)) {
            return res.status(400).json({ message: "Estado de revisión inválido" });
        }

        await firestore.runTransaction(async (transaction) => {
            const arrestoRef = firestore.collection("registro_arrestos").doc(id);
            const arrestoDoc = await transaction.get(arrestoRef);

            if (!arrestoDoc.exists) {
                throw new Error("El registro de arresto no existe");
            }

            const arrestoData = arrestoDoc.data() as any;
            if (arrestoData.estado !== 'PENDIENTE_VALIDACION') {
                throw new Error("Este registro ya fue revisado o no está pendiente de validación");
            }

            // Si se aprueba (PAGADO), descontamos minutos del balance del usuario
            if (estado === 'PAGADO') {
                const userRef = firestore.collection("usuarios").doc(arrestoData.bomberoId);
                const userDoc = await transaction.get(userRef);
                
                if (userDoc.exists) {
                    const userData = userDoc.data();
                    const minutosEfectivos = arrestoData.pagoDoble ? arrestoData.minutos * 2 : arrestoData.minutos;
                    const nuevoBalance = Math.max(0, (userData?.minutosArresto || 0) - minutosEfectivos);
                    transaction.update(userRef, { minutosArresto: nuevoBalance });
                }
            }

            // Actualizar el registro de arresto (el Pago)
            transaction.update(arrestoRef, {
                estado,
                revisadoPor: supervisorId,
                notasRevision,
                fechaActualizacion: new Date()
            });

            // Si es un pago aprobado y tiene un arresto padre (infracción), marcar el padre como PAGADO
            if (estado === 'PAGADO' && arrestoData.parentArrestoId) {
                const parentRef = firestore.collection("registro_arrestos").doc(arrestoData.parentArrestoId);
                transaction.update(parentRef, { 
                    estado: 'PAGADO',
                    fechaActualizacion: new Date()
                });
            }
        });

        const arrestoDoc = await firestore.collection("registro_arrestos").doc(id).get();
        const arrestoData = arrestoDoc.data() as any;

        // Notificar al bombero el resultado
        await NotificacionService.enviar({
            usuarioId: arrestoData.bomberoId,
            titulo: estado === 'PAGADO' ? "✅ Pago validado" : "❌ Pago rechazado",
            mensaje: estado === 'PAGADO' 
                ? `Tu pago de ${arrestoData.minutos} minutos ha sido validado.` 
                : `Tu pago de ${arrestoData.minutos} minutos ha sido rechazado. Motivo: ${notasRevision || 'No especificado'}`,
            tipo: estado === 'PAGADO' ? "EXITO" : "ALERTA",
            link: "/arrestos"
        });
        
        await registrarAuditoria('REVISAR_PAGO_ARRESTO', 'registro_arrestos', id, supervisorId, { estado, minutos: arrestoData.minutos });

        res.status(200).json({ message: `Pago ${estado === 'PAGADO' ? 'validado' : 'rechazado'} exitosamente` });

    } catch (error: any) {
        console.error("Error al revisar pago:", error);
        res.status(500).json({ message: error.message || "Error interno del servidor" });
    }
};

export const obtenerHistorialArrestos = async (req: Request, res: Response) => {
    try {
        const user = (req as any).user;
        const { uid } = user;
        const { relacion, bomberoId: targetId, estado: filterEstado, excluirEstado, tipo: filterTipo } = req.query; 
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 10;
        const skip = (page - 1) * limit;

        let query: any = firestore.collection("registro_arrestos");

        if (relacion === 'asignados') {
            query = query.where("registradoPor", "==", uid);
        } else if (relacion === 'todo') {
            if (targetId) {
                query = query.where("bomberoId", "==", targetId);
            }
        } else {
            query = query.where("bomberoId", "==", uid);
        }

        // Aplicamos filtros adicionales si existen
        if (filterEstado) {
            query = query.where("estado", "==", filterEstado);
        }
        if (filterTipo) {
            query = query.where("tipo", "==", filterTipo);
        }

        const snapshot = await query.get();
        const totalItems = snapshot.size;
        
        let docs = snapshot.docs.map((doc: any) => ({
            id: doc.id,
            ...doc.data(),
            fecha: doc.data().fecha?.toDate ? doc.data().fecha.toDate() : new Date(doc.data().fecha),
            fechaRegistro: doc.data().fechaRegistro?.toDate ? doc.data().fechaRegistro.toDate() : new Date(doc.data().fechaRegistro)
        }));

        if (relacion === 'asignados') {
            docs = docs.filter((doc: any) => doc.tipo === 'INFRACCION');
        }

        // Filtro de exclusión (útil para "Historial General" que excluye pendientes de validación)
        if (excluirEstado) {
            docs = docs.filter((doc: any) => doc.estado !== excluirEstado);
        }

        const filteredTotalItems = docs.length;

        // Ordenamiento manual por fechaRegistro (más reciente primero)
        docs.sort((a: any, b: any) => {
            const timeA = a.fechaRegistro instanceof Date ? a.fechaRegistro.getTime() : 0;
            const timeB = b.fechaRegistro instanceof Date ? b.fechaRegistro.getTime() : 0;
            return timeB - timeA;
        });

        // Aplicamos paginación manual
        const paginatedDocs = docs.slice(skip, skip + limit);

        res.status(200).json({
            items: paginatedDocs,
            totalItems: filteredTotalItems,
            totalPages: Math.ceil(filteredTotalItems / limit),
            currentPage: page
        });
    } catch (error: any) {
        console.error("Error al obtener historial de arrestos:", error);
        res.status(500).json({ message: "Error al obtener el historial" });
    }
};

export const editarArresto = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const currentUserId = (req as any).user.uid;
        const updateData = req.body;

        await firestore.runTransaction(async (transaction) => {
            const arrestoRef = firestore.collection("registro_arrestos").doc(id);
            const arrestoDoc = await transaction.get(arrestoRef);

            if (!arrestoDoc.exists) throw new Error("El registro no existe");
            const arrestoData = arrestoDoc.data() as any;

            const createdAt = arrestoData.fechaRegistro?.toDate ? arrestoData.fechaRegistro.toDate() : new Date(arrestoData.fechaRegistro);
            const hoursSinceCreation = (Date.now() - createdAt.getTime()) / (1000 * 60 * 60);
            const isSuperior = (req as any).user.rol === 'ADMIN' || (req as any).user.rol === 'SUPERVISOR';
            
            if (hoursSinceCreation > 48 && !isSuperior) {
                throw new Error("El tiempo máximo para editar este registro (48 horas) ha expirado.");
            }

            if (arrestoData.registradoPor !== currentUserId && !isSuperior) {
                throw new Error("No tienes permiso para editar este registro.");
            }

            // No permitir cambiar el bombero asignado
            if (updateData.bomberoId && updateData.bomberoId !== arrestoData.bomberoId) {
                throw new Error("No se permite cambiar el bombero asignado.");
            }

            // Ajustar balance si cambiaron los minutos
            if (updateData.minutos !== undefined && updateData.minutos !== arrestoData.minutos) {
                const userRef = firestore.collection("usuarios").doc(arrestoData.bomberoId);
                const userDoc = await transaction.get(userRef);
                if (userDoc.exists) {
                    const diff = updateData.minutos - arrestoData.minutos;
                    let diffEfectivo = arrestoData.pagoDoble ? diff * 2 : diff;
                    
                    if (arrestoData.tipo === 'PAGO') {
                        diffEfectivo = -diffEfectivo; // Si aumenta el pago, disminuye la deuda
                    }
                    
                    const nuevoBalance = (userDoc.data()?.minutosArresto || 0) + diffEfectivo;
                    transaction.update(userRef, { minutosArresto: Math.max(0, nuevoBalance) });
                }
            }

            transaction.update(arrestoRef, {
                ...updateData,
                fechaActualizacion: new Date()
            });
        });
        
        await registrarAuditoria('EDITAR_ARRESTO', 'registro_arrestos', id, currentUserId, { updateFields: Object.keys(updateData) });

        res.status(200).json({ message: "Registro actualizado correctamente" });
    } catch (error: any) {
        res.status(400).json({ message: error.message });
    }
};

export const eliminarArresto = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const currentUserId = (req as any).user.uid;

        await firestore.runTransaction(async (transaction) => {
            const arrestoRef = firestore.collection("registro_arrestos").doc(id);
            const arrestoDoc = await transaction.get(arrestoRef);

            if (!arrestoDoc.exists) throw new Error("El registro no existe");
            const arrestoData = arrestoDoc.data() as any;

            const createdAt = arrestoData.fechaRegistro?.toDate ? arrestoData.fechaRegistro.toDate() : new Date(arrestoData.fechaRegistro);
            const hoursSinceCreation = (Date.now() - createdAt.getTime()) / (1000 * 60 * 60);
            const isSuperior = (req as any).user.rol === 'ADMIN' || (req as any).user.rol === 'SUPERVISOR';
            
            if (hoursSinceCreation > 48 && !isSuperior) {
                throw new Error("El tiempo máximo para eliminar este registro (48 horas) ha expirado.");
            }

            if (arrestoData.registradoPor !== currentUserId && !isSuperior) {
                throw new Error("No tienes permiso para eliminar este registro.");
            }

            // Ajustar el balance del usuario
            const userRef = firestore.collection("usuarios").doc(arrestoData.bomberoId);
            const userDoc = await transaction.get(userRef);
            if (userDoc.exists) {
                const minutosEfectivos = arrestoData.pagoDoble ? arrestoData.minutos * 2 : arrestoData.minutos;
                let nuevoBalance = userDoc.data()?.minutosArresto || 0;
                
                if (arrestoData.tipo === 'PAGO') {
                    nuevoBalance += minutosEfectivos; // Si se elimina el pago, la deuda vuelve
                } else {
                    nuevoBalance -= minutosEfectivos; // Si se elimina la infracción, la deuda baja
                }
                
                transaction.update(userRef, { minutosArresto: Math.max(0, nuevoBalance) });
            }

            transaction.delete(arrestoRef);
        });

        await registrarAuditoria('ELIMINAR_ARRESTO', 'registro_arrestos', id, currentUserId, { id });

        res.status(200).json({ message: "Registro eliminado correctamente" });
    } catch (error: any) {
        res.status(400).json({ message: error.message });
    }
};
