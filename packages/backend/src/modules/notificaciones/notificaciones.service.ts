import { db } from "../../config/firebase";
import { Notificacion } from "@bomberos-usb/shared";
import { eliminarEnChunks, actualizarEnChunks } from "../../utils/batch";

/**
 * Servicio centralizado para gestionar las notificaciones del sistema (In-App).
 */
export const NotificacionService = {
  /**
   * Crea una notificación en Firestore para un usuario específico.
   */
  enviar: async (notificacion: Omit<Notificacion, 'fechaCreacion' | 'id' | 'leida'> & { leida?: boolean }) => {
    try {
      const docRef = await db.collection("notificaciones").add({
        ...notificacion,
        leida: notificacion.leida || false,
        fechaCreacion: new Date()
      });
      
      console.log(`Notificación In-App enviada a usuario ${notificacion.usuarioId}: ${notificacion.titulo}`);
      return docRef.id;
    } catch (error) {
      console.error("Error al crear notificación en Firestore:", error);
      throw error;
    }
  },

  /**
   * Marca una notificación como leída.
   */
  marcarComoLeida: async (notificacionId: string) => {
    try {
      await db.collection("notificaciones").doc(notificacionId).update({
        leida: true,
        fechaActualizacion: new Date()
      });
    } catch (error) {
      console.error("Error al marcar notificación como leída:", error);
      throw error;
    }
  },

  /**
   * Obtiene las notificaciones de un usuario.
   */
  obtenerDeUsuario: async (usuarioId: string) => {
    try {
      const snapshot = await db.collection("notificaciones")
        .where("usuarioId", "==", usuarioId)
        .orderBy("fechaCreacion", "desc")
        .limit(20)
        .get();
        
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    } catch (error) {
      console.error("Error al obtener notificaciones de usuario:", error);
      throw error;
    }
  },

  /**
   * Elimina una notificación específica.
   */
  eliminar: async (notificacionId: string) => {
    try {
      await db.collection("notificaciones").doc(notificacionId).delete();
    } catch (error) {
      console.error("Error al eliminar notificación:", error);
      throw error;
    }
  },

  /**
   * Elimina todas las notificaciones de un usuario.
   */
  eliminarTodas: async (usuarioId: string) => {
    try {
      const snapshot = await db.collection("notificaciones")
        .where("usuarioId", "==", usuarioId)
        .get();

      // Firebase limita cada batch a 500 operaciones → troceado centralizado en utils/batch
      await eliminarEnChunks(snapshot.docs);
    } catch (error) {
      console.error("Error al eliminar todas las notificaciones:", error);
      throw error;
    }
  },

  /**
   * Marca todas las notificaciones de un usuario como leídas.
   */
  marcarTodasComoLeidas: async (usuarioId: string) => {
    try {
      const snapshot = await db.collection("notificaciones")
        .where("usuarioId", "==", usuarioId)
        .where("leida", "==", false)
        .get();

      // Firebase limita cada batch a 500 operaciones → troceado centralizado en utils/batch
      await actualizarEnChunks(snapshot.docs, {
        leida: true,
        fechaActualizacion: new Date()
      });
    } catch (error) {
      console.error("Error al marcar todas como leídas:", error);
      throw error;
    }
  }
};
