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
    const supervisorId = (req as any).user?.uid || "SISTEMA";
    const supervisorNombre = (req as any).user?.nombre || "Supervisor";

    const docRef = await db.collection("guardias").add({
      ...validatedData,
      fecha: new Date(validatedData.fecha), // Asegurar que sea objeto Date para Firestore (Timestamp)
      creadoPor: supervisorId,
      creadoPorNombre: supervisorNombre,
      fechaCreacion: new Date(),
      notificadoRecordatorio: false
    });

    await registrarAuditoria('CREAR_GUARDIA', 'guardias', docRef.id, supervisorId, validatedData);

    // Notificar al bombero asignado
    await NotificacionService.enviar({
      usuarioId: validatedData.bomberoId,
      titulo: "Nueva Guardia Asignada",
      mensaje: `Se te ha asignado una nueva guardia para el ${new Date(validatedData.fecha).toLocaleDateString()}. Turno: ${validatedData.turno}.`,
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

// Obtener todas las guardias (R)
export const obtenerGuardias = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { rel, limite, bomberoId: targetId } = req.query;
    const pageSize = limite ? parseInt(limite as string) : 50;
    
    let query: any = db.collection("guardias");

    // Filtrado por relación
    if (rel === 'mis-guardias') {
        query = query.where("bomberoId", "==", user.uid);
    } else if (rel === 'gestion' && (user.rol === 'SUPERVISOR' || user.rol === 'ADMIN')) {
        if (targetId) {
            query = query.where("bomberoId", "==", targetId);
        }
    }

    // Ordenar por fecha (más recientes primero)
    query = query.orderBy("fecha", "desc");

    const snapshot = await query.limit(pageSize).get();
    const guardias = snapshot.docs.map((doc: any) => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        fecha: data.fecha?.toDate ? data.fecha.toDate() : new Date(data.fecha),
        fechaCreacion: data.fechaCreacion?.toDate ? data.fechaCreacion.toDate() : new Date(data.fechaCreacion)
      };
    });

    res.status(200).json(guardias);
  } catch (error: any) {
    console.error("Error al obtener guardias:", error);
    res.status(500).json({ message: "Error al obtener las guardias" });
  }
};

// Actualizar una guardia (U) - Genérico para Supervisores
export const actualizarGuardia = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const user = (req as any).user;
    
    if (user.rol !== 'SUPERVISOR' && user.rol !== 'ADMIN') {
        return res.status(403).json({ message: "No tienes permiso para editar guardias" });
    }

    const validatedData = GuardiaSchema.partial().parse(req.body);
    const docRef = db.collection("guardias").doc(id);
    const doc = await docRef.get();

    if (!doc.exists) {
      return res.status(404).json({ message: "Guardia no encontrada" });
    }

    const updateData: any = {
      ...validatedData,
      fechaActualizacion: new Date()
    };

    if (validatedData.fecha) {
        updateData.fecha = new Date(validatedData.fecha);
    }

    await docRef.update(updateData);

    await registrarAuditoria('ACTUALIZAR_GUARDIA', 'guardias', id, user.uid, validatedData);

    res.status(200).json({ message: "Guardia actualizada exitosamente" });
  } catch (error: any) {
    if (error instanceof ZodError) {
      return res.status(400).json({ errors: error.flatten() });
    }
    console.error("Error al actualizar guardia:", error);
    res.status(500).json({ message: "Error interno del servidor" });
  }
};

// Completar Guardia (U - Supervisor Only)
export const completarGuardia = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { observaciones, minutosEfectivos } = req.body;
    const user = (req as any).user;

    if (user.rol !== 'SUPERVISOR' && user.rol !== 'ADMIN') {
        return res.status(403).json({ message: "Solo los supervisores pueden marcar guardias como completadas" });
    }

    const docRef = db.collection("guardias").doc(id);
    const doc = await docRef.get();

    if (!doc.exists) {
      return res.status(404).json({ message: "Guardia no encontrada" });
    }

    const guardiaData = doc.data() as any;

    await docRef.update({
      estado: 'COMPLETADA',
      minutosEfectivos: minutosEfectivos !== undefined ? minutosEfectivos : guardiaData.minutos,
      observaciones: observaciones || guardiaData.observaciones || "",
      fechaActualizacion: new Date()
    });

    await registrarAuditoria('COMPLETAR_GUARDIA', 'guardias', id, user.uid, { observaciones, minutosEfectivos });

    // Notificar al bombero
    const fechaGuardia = guardiaData.fecha?.toDate ? guardiaData.fecha.toDate() : new Date(guardiaData.fecha);
    await NotificacionService.enviar({
      usuarioId: guardiaData.bomberoId,
      titulo: "✅ Guardia Completada",
      mensaje: `Tu guardia del ${fechaGuardia.toLocaleDateString()} ha sido marcada como completada por un supervisor.`,
      tipo: "EXITO",
      link: "/guardias"
    });

    res.status(200).json({ message: "Guardia marcada como completada" });

  } catch (error: any) {
    console.error("Error al completar guardia:", error);
    res.status(500).json({ message: "Error interno del servidor" });
  }
};

// Marcar Inasistencia (U - Supervisor Only)
export const marcarInasistencia = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { observaciones } = req.body;
      const user = (req as any).user;
  
      if (user.rol !== 'SUPERVISOR' && user.rol !== 'ADMIN') {
          return res.status(403).json({ message: "Solo los supervisores pueden marcar inasistencias" });
      }
  
      const docRef = db.collection("guardias").doc(id);
      const doc = await docRef.get();
  
      if (!doc.exists) {
        return res.status(404).json({ message: "Guardia no encontrada" });
      }
  
      const guardiaData = doc.data() as any;
  
      await docRef.update({
        estado: 'INASISTENCIA',
        observaciones: observaciones || guardiaData.observaciones || "",
        fechaActualizacion: new Date()
      });
  
      await registrarAuditoria('INASISTENCIA_GUARDIA', 'guardias', id, user.uid, { observaciones });
  
      // Notificar al bombero
      const fechaGuardia = guardiaData.fecha?.toDate ? guardiaData.fecha.toDate() : new Date(guardiaData.fecha);
      await NotificacionService.enviar({
        usuarioId: guardiaData.bomberoId,
        titulo: "🚨 Inasistencia Registrada",
        mensaje: `Se ha registrado una inasistencia en tu guardia del ${fechaGuardia.toLocaleDateString()}.`,
        tipo: "ALERTA",
        link: "/guardias"
      });
  
      res.status(200).json({ message: "Inasistencia registrada" });
  
    } catch (error: any) {
      console.error("Error al registrar inasistencia:", error);
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

    // Notificar al bombero
    if (guardiaData) {
      const fechaGuardia = guardiaData.fecha?.toDate ? guardiaData.fecha.toDate() : new Date(guardiaData.fecha);
      await NotificacionService.enviar({
        usuarioId: guardiaData.bomberoId,
        titulo: "🗑️ Guardia Eliminada",
        mensaje: `Una guardia programada para el ${fechaGuardia.toLocaleDateString()} ha sido eliminada por un supervisor.`,
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

