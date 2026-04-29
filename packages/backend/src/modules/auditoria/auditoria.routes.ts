import { Router } from "express";
import { obtenerLogs, eliminarLogs } from "./auditoria.controller";
import { tokenVerification, roleCheck } from '../../middleware/auth.middleware';

const router = Router();

// Todas las rutas de auditoría son EXCLUSIVAS para ADMIN
router.get("/", tokenVerification, roleCheck(['ADMIN']), obtenerLogs);
router.post("/eliminar", tokenVerification, roleCheck(['ADMIN']), eliminarLogs);

export default router;
