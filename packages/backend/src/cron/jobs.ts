import cron from 'node-cron';
import { db } from '../config/firebase';
import { NotificacionService } from '../modules/notificaciones/notificaciones.service';

/**
 * Tarea 1: Recordatorio de Guardia Próxima (1 hora antes)
 * Se ejecuta cada 15 minutos.
 */
export const startUpcomingGuardiasCron = () => {
  cron.schedule('*/15 * * * *', async () => {
    console.log('[CRON] Buscando guardias próximas...');
    try {
      const ahora = new Date();
      const enUnaHora = new Date(ahora.getTime() + 60 * 60 * 1000);
      const enUnaHoraYQuince = new Date(ahora.getTime() + 75 * 60 * 1000);

      const snapshot = await db.collection("guardias")
        .where("estado", "==", "PENDIENTE")
        .where("notificadoRecordatorio", "==", false)
        .where("fechaInicio", ">=", ahora) // Que no hayan pasado ya
        .get();

      const promises = snapshot.docs.map(async (doc) => {
        const data = doc.data();
        const fechaInicio = data.fechaInicio.toDate ? data.fechaInicio.toDate() : new Date(data.fechaInicio);
        
        // Si falta entre 0 y 60 minutos (o el umbral que definamos)
        const diffMs = fechaInicio.getTime() - ahora.getTime();
        const diffMin = diffMs / (1000 * 60);

        if (diffMin <= 60 && diffMin > 0) {
          await NotificacionService.enviar({
            usuarioId: data.bomberoId,
            titulo: "Recordatorio de Guardia",
            mensaje: `Tu guardia está programada para iniciar en aproximadamente ${Math.round(diffMin)} minutos.`,
            tipo: "INFO",
            link: "/guardias"
          });

          await doc.ref.update({ notificadoRecordatorio: true });
        }
      });

      await Promise.all(promises);
    } catch (error) {
      console.error("[CRON Error] Upcoming Guardias:", error);
    }
  });
};

export const startDelayAlertsCron = () => {
  cron.schedule('*/5 * * * *', async () => {
    console.log('[CRON] Buscando retrasos en el inicio de guardia...');
    try {
      const ahora = new Date();
      const haceQuinceMinutos = new Date(ahora.getTime() - 15 * 60 * 1000);
      const haceUnaHora = new Date(ahora.getTime() - 60 * 60 * 1000);

      // Obtenemos supervisores
      const supervisoresSnapshot = await db.collection("usuarios")
        .where("rol", "==", "SUPERVISOR")
        .where("activo", "==", true)
        .get();
      const supervisoresIds = supervisoresSnapshot.docs.map(d => d.id);

      // 1. RETRASO NORMAL (15-60 min)
      const snapshotNormal = await db.collection("guardias")
        .where("estado", "==", "PENDIENTE")
        .where("notificadoRetraso", "==", false)
        .where("fechaInicio", "<=", haceQuinceMinutos)
        .get();

      const promisesNormal = snapshotNormal.docs.map(async (doc) => {
        const data = doc.data();
        
        const msg = `La guardia pautada para las ${data.fechaInicio.toDate().toLocaleTimeString()} no ha iniciado. ¿Quieres marcarla como iniciada?`;
        
        const notifies = supervisoresIds.map(supId => 
          NotificacionService.enviar({
            usuarioId: supId,
            titulo: "⚠️ Retraso detectado",
            mensaje: `El bombero ${data.bomberoNombre} no ha marcado inicio. ${msg}`,
            tipo: "ALERTA",
            link: "/guardias"
          })
        );

        const notifyBombero = NotificacionService.enviar({
            usuarioId: data.bomberoId,
            titulo: "⚠️ Olvido de Inicio",
            mensaje: `Tu guardia ya debió iniciar. ¿Deseas marcar el inicio ahora?`,
            tipo: "ALERTA",
            link: "/guardias"
        });

        await Promise.all([...notifies, notifyBombero]);
        await doc.ref.update({ notificadoRetraso: true });
      });

      // 2. RETRASO GRAVE (+60 min)
      const snapshotGrave = await db.collection("guardias")
        .where("estado", "==", "PENDIENTE")
        .where("notificadoRetrasoGrave", "==", false)
        .where("fechaInicio", "<=", haceUnaHora)
        .get();

      const promisesGrave = snapshotGrave.docs.map(async (doc) => {
        const data = doc.data();
        
        const notifies = supervisoresIds.map(supId => 
          NotificacionService.enviar({
            usuarioId: supId,
            titulo: "🚨 RETRASO CRÍTICO",
            mensaje: `MÁS DE 1 HORA DE RETRASO para ${data.bomberoNombre}. Puedes marcar inicio o declarar INASISTENCIA.`,
            tipo: "ALERTA",
            link: "/guardias"
          })
        );

        await Promise.all(notifies);
        await doc.ref.update({ notificadoRetrasoGrave: true });
      });

      await Promise.all([...promisesNormal, ...promisesGrave]);
    } catch (error) {
      console.error("[CRON Error] Delay Alerts:", error);
    }
  });
};

/**
 * Tarea 3: Gestión de Cierre de Guardia
 * Alertas por olvido de cierre y autocompletado.
 * Se ejecuta cada 10 minutos.
 */
export const startAutoCompletionCron = () => {
  cron.schedule('*/5 * * * *', async () => {
    console.log(`[CRON] [${new Date().toLocaleTimeString()}] Gestionando cierres de guardia...`);
    try {
      const ahora = new Date();
      const haceQuinceMinutos = new Date(ahora.getTime() - 15 * 60 * 1000);
      const haceDosHoras = new Date(ahora.getTime() - 120 * 60 * 1000);

      // Obtenemos supervisores
      const supervisoresSnapshot = await db.collection("usuarios")
        .where("rol", "==", "SUPERVISOR")
        .where("activo", "==", true)
        .get();
      const supervisoresIds = supervisoresSnapshot.docs.map(d => d.id);

      // Buscamos todas las guardias en curso (es más seguro filtrar el tiempo en memoria por ahora)
      const snapshot = await db.collection("guardias")
        .where("estado", "==", "EN_CURSO")
        .get();

      if (snapshot.empty) {
        return; // No hay guardias en curso
      }

      for (const doc of snapshot.docs) {
        const data = doc.data();
        const fechaFin = data.fechaFin?.toDate ? data.fechaFin.toDate() : new Date(data.fechaFin);
        
        // 1. ALERTAS POR OLVIDO DE CIERRE (+15 min)
        const yaPasaron15m = fechaFin.getTime() <= haceQuinceMinutos.getTime();
        const yaPasaron2h = fechaFin.getTime() <= haceDosHoras.getTime();

        if (yaPasaron15m && !data.notificadoFinSinMarcar && !yaPasaron2h) {
            console.log(`[CRON] Enviando alerta de olvido a: ${data.bomberoNombre || data.bomberoId}`);
            
            const notifyBombero = NotificacionService.enviar({
                usuarioId: data.bomberoId,
                titulo: "⏳ Guardia pendiente de cierre",
                mensaje: `Tu horario ya finalizó. Por favor, marca la guardia como completa para el registro.`,
                tipo: "ALERTA",
                link: "/guardias"
            });

            const notifySupervisores = supervisoresIds.map(supId => 
              NotificacionService.enviar({
                usuarioId: supId,
                titulo: "⚠️ Guardia sin finalizar",
                mensaje: `El bombero ${data.bomberoNombre} no ha marcado el fin de su guardia.`,
                tipo: "ALERTA",
                link: "/guardias"
              })
            );

            await Promise.all([notifyBombero, ...notifySupervisores]);
            await doc.ref.update({ notificadoFinSinMarcar: true });
            console.log(`[CRON] Alerta enviada para guardia: ${doc.id}`);
        }

        // 2. AUTO-COMPLETADO (+2 horas)
        if (yaPasaron2h) {
            console.log(`[CRON] Auto-completando guardia de: ${data.bomberoNombre}`);
            const obsAnterior = data.observaciones || "";
            const obsNueva = `${obsAnterior}\n[SISTEMA]: Cierre automático por finalización de horario.`.trim();

            await doc.ref.update({
                estado: "COMPLETADA",
                observaciones: obsNueva,
                fechaActualizacion: ahora
            });

            const notifyBombero = NotificacionService.enviar({
                usuarioId: data.bomberoId,
                titulo: "✅ Guardia completada (Auto)",
                mensaje: `Tu guardia ha sido marcada como completada automáticamente por el sistema.`,
                tipo: "EXITO",
                link: "/guardias"
            });

            const notifySupervisores = supervisoresIds.map(supId => 
              NotificacionService.enviar({
                usuarioId: supId,
                titulo: "✅ Cierre automático",
                mensaje: `La guardia de ${data.bomberoNombre} fue cerrada automáticamente tras 2 horas de inactividad.`,
                tipo: "EXITO",
                link: "/guardias"
              })
            );

            await Promise.all([notifyBombero, ...notifySupervisores]);
            console.log(`[CRON] Auto-completado exitoso para: ${doc.id}`);
        }
      }
    } catch (error) {
      console.error("[CRON Error] Auto-Completion:", error);
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
 * Tarea 4: Limpieza automática de Auditoría
 * Se ejecuta diariamente a la medianoche.
 */
export const startAuditCleanupCron = () => {
  // Ejecutar una vez al encender el servidor (útil para Render/servidores que se duermen)
  runAuditCleanup();

  // Programar para que se ejecute cada medianoche
  cron.schedule('0 0 * * *', async () => {
    runAuditCleanup();
  });
};
