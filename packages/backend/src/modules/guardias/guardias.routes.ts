import { Router } from "express";
import { 
  crearGuardia,
  obtenerGuardias, 
  actualizarGuardia, 
  eliminarGuardia,
  completarGuardia,
  iniciarGuardia
} from "./guardias.controller";
import { tokenVerification, roleCheck } from '../../middleware/auth.middleware';

const router = Router();

// Todos los usuarios autenticados pueden ver las guardias
router.get('/', tokenVerification, obtenerGuardias);

// Solo supervisores pueden gestionar guardias (crear y editar)
router.post('/', tokenVerification, roleCheck(['SUPERVISOR']), crearGuardia);
router.patch('/:id', tokenVerification, roleCheck(['SUPERVISOR']), actualizarGuardia);
router.patch('/:id/iniciar', tokenVerification, iniciarGuardia);
router.patch('/:id/completar', tokenVerification, completarGuardia);
router.delete('/:id', tokenVerification, roleCheck(['SUPERVISOR']), eliminarGuardia);

export default router;
