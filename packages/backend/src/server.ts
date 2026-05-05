import app from './app';
import { startDailyGuardiasReminderCron, startAuditCleanupCron } from './cron/jobs';

const PORT = process.env.PORT || 3000;

app.listen(PORT, () =>{
    console.log(`Servidor encontrado en http://localhost:${PORT}`);
    
    // Iniciar tareas programadas (CRON)
    startDailyGuardiasReminderCron();
    startAuditCleanupCron();
});