import cron from 'node-cron';
import { db } from '../config/firebase';
import { NotificacionService } from '../modules/notificaciones/notificaciones.service';

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

    const docs = snapshot.docs;
    for (let i = 0; i < docs.length; i += 500) {
      const batch = db.batch();
      const chunk = docs.slice(i, i + 500);
      chunk.forEach(doc => batch.delete(doc.ref));
      await batch.commit();
    }

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

