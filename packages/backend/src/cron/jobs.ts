import cron from 'node-cron';
import { db } from '../config/firebase';
import { NotificacionService } from '../modules/notificaciones/notificaciones.service';
import { eliminarEnChunks } from '../utils/batch';

/**
 * Tarea 1: Recordatorio Diario de Guardias
 * Se ejecuta todos los días a las 6:00 AM.
 * Busca guardias para el DÍA ACTUAL y envía un solo recordatorio.
 */
export const startDailyGuardiasReminderCron = () => {
  cron.schedule('0 6 * * *', async () => {
    console.log('[CRON] Buscando guardias del día...');
    try {
      const hoy = new Date();
      hoy.setHours(0, 0, 0, 0);
      const mañana = new Date(hoy);
      mañana.setDate(mañana.getDate() + 1);

      const snapshot = await db.collection("guardias")
        .where("estado", "==", "PENDIENTE")
        .where("notificadoRecordatorio", "==", false)
        .where("fecha", ">=", hoy)
        .where("fecha", "<", mañana)
        .get();

      if (snapshot.empty) return;

      const promises = snapshot.docs.map(async (doc) => {
        const data = doc.data();
        
        // Obtener datos del bombero para saber si es regular o no regular
        const bomberoDoc = await db.collection("usuarios").doc(data.bomberoId).get();
        const bomberoData = bomberoDoc.data();
        
        const isRegular = bomberoData?.condicion === 'REGULAR' || !bomberoData?.condicion;
        
        let mensaje = "";
        if (isRegular) {
            mensaje = `Recordatorio: Hoy tienes guardia programada en la Sede ${data.sede || 'Sartenejas'}, Turno ${data.turno}.`;
        } else {
            mensaje = `Recordatorio: Hoy tienes guardia programada en la Sede ${data.sede || 'Sartenejas'}.`;
        }

        await NotificacionService.enviar({
          usuarioId: data.bomberoId,
          titulo: "📅 Guardia de Hoy",
          mensaje: mensaje,
          tipo: "INFO",
          link: "/guardias"
        });

        await doc.ref.update({ notificadoRecordatorio: true });
      });

      await Promise.all(promises);
      console.log(`[CRON] Se enviaron ${snapshot.size} recordatorios de guardia.`);
    } catch (error) {
      console.error("[CRON Error] Daily Guardias:", error);
    }
  });
};

/**
 * Lógica de limpieza de auditoría
 */
export const runAuditCleanup = async () => {
  console.log('[SISTEMA] Iniciando limpieza de auditoría (registros > 3 meses)...');
  try {
    const ahora = new Date();
    const haceTresMeses = new Date();
    haceTresMeses.setMonth(ahora.getMonth() - 3);

    const snapshot = await db.collection("auditoria")
      .where("timestamp", "<", haceTresMeses)
      .get();

    if (snapshot.empty) {
      console.log('[SISTEMA] Auditoría: No hay registros antiguos para eliminar.');
      return;
    }

    console.log(`[SISTEMA] Auditoría: Se encontraron ${snapshot.size} registros obsoletos.`);

    await eliminarEnChunks(snapshot.docs);

    console.log(`[SISTEMA] Auditoría: Limpieza completada exitosamente. Se eliminaron ${snapshot.size} registros.`);
  } catch (error) {
    console.error("[SISTEMA Error] Audit Cleanup:", error);
  }
};

/**
 * Tarea 2: Limpieza automática de Auditoría
 * Se ejecuta diariamente a la medianoche.
 */
export const startAuditCleanupCron = () => {
  runAuditCleanup();
  cron.schedule('0 0 * * *', async () => {
    runAuditCleanup();
  });
};

/**
 * Limpieza de notificaciones vencidas
 * La notificación es estado transitorio de la campana (se muestran las últimas 20
 * y abrirla marca todo como leído), no un registro histórico: se conservan
 * DIAS_RETENCION_NOTIFICACIONES desde su creación y luego se eliminan.
 */
const DIAS_RETENCION_NOTIFICACIONES = 30;

export const runNotificationsCleanup = async () => {
  try {
    const limite = new Date();
    limite.setDate(limite.getDate() - DIAS_RETENCION_NOTIFICACIONES);

    const snapshot = await db.collection("notificaciones")
      .where("fechaCreacion", "<", limite)
      .get();

    if (snapshot.empty) {
      console.log('[SISTEMA] Notificaciones: No hay notificaciones vencidas para eliminar.');
      return;
    }

    console.log(`[SISTEMA] Notificaciones: Se encontraron ${snapshot.size} notificaciones vencidas.`);

    await eliminarEnChunks(snapshot.docs);

    console.log(`[SISTEMA] Notificaciones: Limpieza completada. Se eliminaron ${snapshot.size} notificaciones.`);
  } catch (error) {
    // No se relanza: un fallo aquí no debe impedir el arranque del servidor
    console.error("[SISTEMA Error] Notifications Cleanup:", error);
  }
};

/**
 * Tarea 3: Limpieza automática de notificaciones vencidas
 * Se ejecuta al arranque (en Render free la instancia duerme y el cron de
 * madrugada no siempre llega a dispararse) y luego diariamente a la 01:00
 * del servidor (UTC), que son las 21:00 en Venezuela.
 */
export const startNotificationsCleanupCron = () => {
  runNotificationsCleanup();
  cron.schedule('0 1 * * *', async () => {
    runNotificationsCleanup();
  });
};

