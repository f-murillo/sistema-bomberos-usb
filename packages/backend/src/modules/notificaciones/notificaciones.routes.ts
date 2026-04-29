import { Router } from "express";
import { getMisNotificaciones, marcarLeida, eliminarNotificacion, eliminarTodasLasNotificaciones, marcarTodasLeidas } from "./notificaciones.controller";
import { tokenVerification } from "../../middleware/auth.middleware";

const router = Router();

// Todas las rutas de notificaciones requieren autenticación
router.get("/", tokenVerification, getMisNotificaciones);
router.patch("/leida", tokenVerification, marcarTodasLeidas);
router.patch("/:id/leida", tokenVerification, marcarLeida);
router.delete("/:id", tokenVerification, eliminarNotificacion);
router.delete("/", tokenVerification, eliminarTodasLasNotificaciones);

export default router;
