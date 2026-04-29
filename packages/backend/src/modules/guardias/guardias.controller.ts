import { Request, Response } from "express";
import { ZodError } from "zod";
import { GuardiaSchema } from "@bomberos-usb/shared";
import { db } from "../../config/firebase";
import { registrarAuditoria } from "../../utils/auditoria";
import { NotificacionService } from "../notificaciones/notificaciones.service";

// Crear una guardia (C)
export const crearGuardia = async (req: Request, res: Response) => {
  try {
    const validatedData = GuardiaSchema.parse(req.body);
    const userId = (req as any).user?.uid || "SISTEMA";

    const docRef = await db.collection("guardias").add({
      ...validatedData,
      creadoPor: userId,
      fechaCreacion: new Date(),
      // Inicializar flags de notificación explícitamente para Firestore
      notificadoRecordatorio: false,
      notificadoRetraso: false,
      notificadoRetrasoGrave: false,
      notificadoFinSinMarcar: false
    });

    await registrarAuditoria('CREAR_GUARDIA', 'guardias', docRef.id, userId, validatedData);

    // Notificar al bombero asignado
    await NotificacionService.enviar({
      usuarioId: validatedData.bomberoId,
      titulo: "Nueva Guardia Asignada",
      mensaje: `Se te ha asignado una nueva guardia para el ${new Date(validatedData.fechaInicio).toLocaleDateString()}.`,
      tipo: "INFO",
      link: "/guardias"
    });

    res.status(201).json({
      message: "Guardia creada exitosamente",
      id: docRef.id
    });
  } catch (error: any) {
    if (error instanceof ZodError) {
      return res.status(400).json({ errors: error.flatten() });
    }
    console.error("Error al crear guardia:", error);
    res.status(500).json({ message: "Error interno del servidor" });
  }
};

// Obtener todas las guardias (R) con paginación
export const obtenerGuardias = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { ultimoId, limite } = req.query;
    const pageSize = limite ? parseInt(limite as string) : 20;
    
    let query: any = db.collection("guardias");

    // Si el usuario es BOMBERO, solo puede ver las suyas
    if (user && user.rol === "BOMBERO") {
      query = query.where("bomberoId", "==", user.uid);
    }
    
    // Ordenar después del filtrado
    query = query.orderBy("fechaInicio", "desc"); // Ordenar por las más recientes primero

    // Paginación basada en cursor
    if (ultimoId) {
      const lastDoc = await db.collection("guardias").doc(ultimoId as string).get();
      if (lastDoc.exists) {
        query = query.startAfter(lastDoc);
      }
    }

    const snapshot = await query.limit(pageSize).get();
    const guardias = snapshot.docs.map((doc: any) => ({
      id: doc.id,
      ...doc.data(),
      // Convertir timestamps de Firebase a Date si es necesario
      fechaInicio: doc.data().fechaInicio?.toDate ? doc.data().fechaInicio.toDate() : doc.data().fechaInicio,
      fechaFin: doc.data().fechaFin?.toDate ? doc.data().fechaFin.toDate() : doc.data().fechaFin,
    }));

    res.status(200).json(guardias);
  } catch (error: any) {
    console.error("Error al obtener guardias:", error);
    res.status(500).json({ message: "Error al obtener las guardias" });
  }
};

// Actualizar una guardia (U)
export const actualizarGuardia = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const validatedData = GuardiaSchema.partial().parse(req.body);
    const userId = (req as any).user?.uid || "SISTEMA";

    const docRef = db.collection("guardias").doc(id);
    const doc = await docRef.get();

    if (!doc.exists) {
      return res.status(404).json({ message: "Guardia no encontrada" });
    }

    await docRef.update({
      ...validatedData,
      fechaActualizacion: new Date()
    });

    let accionAuditoria: 'ACTUALIZAR_GUARDIA' | 'CANCELAR_GUARDIA' | 'INASISTENCIA_GUARDIA' = 'ACTUALIZAR_GUARDIA';
    if (validatedData.estado === 'CANCELADA') accionAuditoria = 'CANCELAR_GUARDIA';
    if (validatedData.estado === 'INASISTENCIA') accionAuditoria = 'INASISTENCIA_GUARDIA';

    await registrarAuditoria(accionAuditoria, 'guardias', id, userId, validatedData);

    // Si se modifican detalles, notificar al bombero
    const guardiaActual = doc.data();
    if (guardiaActual) {
      let titulo = "Guardia Modificada";
      let mensaje = "Un supervisor ha actualizado los detalles de una de tus guardias programadas.";
      let tipo: "INFO" | "ALERTA" | "EXITO" = "INFO";

      if (validatedData.estado === 'INASISTENCIA') {
        titulo = "🚨 Inasistencia Registrada";
        mensaje = `Se ha registrado una INASISTENCIA en tu guardia del ${new Date(guardiaActual.fechaInicio).toLocaleDateString()}.`;
        tipo = "ALERTA";
      } else if (validatedData.estado === 'CANCELADA') {
        titulo = "🚫 Guardia Cancelada";
        mensaje = `Tu guardia del ${new Date(guardiaActual.fechaInicio).toLocaleDateString()} ha sido cancelada por un supervisor.`;
        tipo = "ALERTA";
      } else {
        tipo = "INFO";
      }

      await NotificacionService.enviar({
        usuarioId: guardiaActual.bomberoId,
        titulo,
        mensaje,
        tipo,
        link: "/guardias"
      });
    }

    res.status(200).json({ message: "Guardia actualizada exitosamente" });
  } catch (error: any) {
    if (error instanceof ZodError) {
      return res.status(400).json({ errors: error.flatten() });
    }
    console.error("Error al actualizar guardia:", error);
    res.status(500).json({ message: "Error interno del servidor" });
  }
};

// Eliminar una guardia (D)
export const eliminarGuardia = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user?.uid || "SISTEMA";

    const docRef = db.collection("guardias").doc(id);
    const doc = await docRef.get();

    if (!doc.exists) {
      return res.status(404).json({ message: "Guardia no encontrada" });
    }

    const guardiaData = doc.data();
    await docRef.delete();
    await registrarAuditoria('ELIMINAR_GUARDIA', 'guardias', id, userId);

    // Notificar al bombero que su guardia fue eliminada permanentemente
    if (guardiaData) {
      await NotificacionService.enviar({
        usuarioId: guardiaData.bomberoId,
        titulo: "🗑️ Guardia Eliminada",
        mensaje: `Una guardia que tenías programada para el ${new Date(guardiaData.fechaInicio).toLocaleDateString()} ha sido eliminada del sistema.`,
        tipo: "ALERTA",
        link: "/guardias"
      });
    }

    res.status(200).json({ message: "Guardia eliminada exitosamente" });
  } catch (error: any) {
    console.error("Error al eliminar guardia:", error);
    res.status(500).json({ message: "Error interno del servidor" });
  }
};

// Marcar inicio de guardia (U - para Bomberos)
export const iniciarGuardia = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const user = (req as any).user;

    const docRef = db.collection("guardias").doc(id);
    const doc = await docRef.get();

    if (!doc.exists) {
      return res.status(404).json({ message: "Guardia no encontrada" });
    }

    const guardiaData = doc.data() as any;

    // 1. Verificar pertenencia o rol
    if (guardiaData.bomberoId !== user.uid && user.rol !== 'SUPERVISOR') {
      return res.status(403).json({ message: "No tienes permiso para iniciar esta guardia" });
    }

    // 2. Validación de tiempo: solo si ya es la hora de inicio (o muy cerca)
    const fechaInicio = guardiaData.fechaInicio?.toDate ? guardiaData.fechaInicio.toDate() : new Date(guardiaData.fechaInicio);
    const ahora = new Date();
    
    // Permitir iniciar hasta 10 min antes por flexibilidad
    if (ahora.getTime() < (fechaInicio.getTime() - 10 * 60 * 1000)) {
      return res.status(400).json({ 
        message: "Aún es muy temprano para iniciar esta guardia",
        fechaInicio: fechaInicio
      });
    }

    // 3. Actualizar estado a EN_CURSO
    await docRef.update({
      estado: 'EN_CURSO',
      fechaActualizacion: ahora
    });

    await registrarAuditoria('INICIAR_GUARDIA', 'guardias', id, user.uid);

    // Notificar a supervisores
    const supervisoresSnapshot = await db.collection("usuarios")
      .where("rol", "==", "SUPERVISOR")
      .where("activo", "==", true)
      .get();
    
    for (const supDoc of supervisoresSnapshot.docs) {
      await NotificacionService.enviar({
        usuarioId: supDoc.id,
        titulo: "Guardia Iniciada",
        mensaje: `El bombero ${guardiaData.bomberoNombre || 'asignado'} ha marcado el inicio de su guardia.`,
        tipo: "INFO",
        link: "/guardias"
      });
    }

    res.status(200).json({ message: "Guardia iniciada correctamente" });

  } catch (error: any) {
    console.error("Error al iniciar guardia:", error);
    res.status(500).json({ message: "Error interno del servidor" });
  }
};

// Marcar guardia como completada (U - para Bomberos)
export const completarGuardia = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const user = (req as any).user;

    const docRef = db.collection("guardias").doc(id);
    const doc = await docRef.get();

    if (!doc.exists) {
      return res.status(404).json({ message: "Guardia no encontrada" });
    }

    const guardiaData = doc.data() as any;

    const esDueno = guardiaData.bomberoId === user.uid;
    const esSupervisor = user.rol === 'SUPERVISOR';

    if (!esDueno && !esSupervisor) {
      return res.status(403).json({ message: "No tienes permiso para marcar esta guardia como completada" });
    }

    const fechaFin = guardiaData.fechaFin?.toDate ? guardiaData.fechaFin.toDate() : new Date(guardiaData.fechaFin);
    const ahora = new Date();

    if (ahora < fechaFin && !esSupervisor) {
      return res.status(400).json({ 
        message: "No puedes completar la guardia antes de su hora de término",
        fechaFin: fechaFin
      });
    }

    await docRef.update({
      estado: 'COMPLETADA',
      fechaActualizacion: ahora
    });

    await registrarAuditoria('COMPLETAR_GUARDIA', 'guardias', id, user.uid);

    const supervisoresSnapshot = await db.collection("usuarios")
      .where("rol", "==", "SUPERVISOR")
      .where("activo", "==", true)
      .get();
    
    for (const supDoc of supervisoresSnapshot.docs) {
      await NotificacionService.enviar({
        usuarioId: supDoc.id,
        titulo: "Guardia Finalizada",
        mensaje: `El bombero ${guardiaData.bomberoNombre || 'asignado'} ha completado su turno satisfactoriamente.`,
        tipo: "EXITO",
        link: "/guardias"
      });
    }

    await NotificacionService.enviar({
      usuarioId: guardiaData.bomberoId,
      titulo: "Turno Completado",
      mensaje: "Has finalizado tu guardia exitosamente. ¡Gracias por tu servicio!",
      tipo: "EXITO",
      link: "/guardias"
    });

    res.status(200).json({ message: "Guardia marcada como completada" });

  } catch (error: any) {
    console.error("Error al completar guardia:", error);
    res.status(500).json({ message: "Error interno del servidor" });
  }
};
