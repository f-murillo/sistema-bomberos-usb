import { Router } from "express";
import { 
    registrarInfraccion, 
    reportarPago, 
    revisarPago, 
    obtenerHistorialArrestos,
    editarArresto,
    eliminarArresto
} from "./arrestos.controller";
import { tokenVerification, roleCheck } from "../../middleware/auth.middleware";

const router = Router();

// Todas las rutas requieren autenticación
router.use(tokenVerification);

// Obtener historial
router.get("/", obtenerHistorialArrestos);

// Bomberos reportan sus pagos
router.post("/pago", roleCheck(['BOMBERO', 'SUPERVISOR', 'ADMIN']), reportarPago);

// Gestión de infracciones
router.post("/infraccion", roleCheck(['BOMBERO', 'SUPERVISOR', 'ADMIN']), registrarInfraccion);
router.patch("/:id", roleCheck(['BOMBERO', 'SUPERVISOR', 'ADMIN']), editarArresto);
router.delete("/:id", roleCheck(['BOMBERO', 'SUPERVISOR', 'ADMIN']), eliminarArresto);

// Revisión de pagos (solo supervisores/admin)
router.patch("/:id/revisar", roleCheck(['SUPERVISOR', 'ADMIN']), revisarPago);

export default router;
