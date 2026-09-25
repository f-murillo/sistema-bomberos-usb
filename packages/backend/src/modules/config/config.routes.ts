import { Router } from "express";
import { obtenerLimites, actualizarLimites } from "./config.controller";
import { tokenVerification, roleCheck } from '../../middleware/auth.middleware';

const router = Router();

// Cualquier usuario autenticado puede consultar los límites vigentes (los usa en cálculos)
router.get("/limites", tokenVerification, obtenerLimites);

// Solo Inspector General o Cuenta Administrativa pueden modificarlos
router.put("/limites", tokenVerification, roleCheck(['SUPERVISOR', 'CUENTA_ADMINISTRATIVA']), actualizarLimites);

export default router;
