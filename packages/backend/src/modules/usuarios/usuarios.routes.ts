import { Router } from "express";
import { actualizarUsuario, crearUsuario, eliminarUsuario, obtenerUsuarios, cambiarPassword, obtenerUsuario } from "./usuarios.controller";
import { tokenVerification, roleCheck } from '../../middleware/auth.middleware';

const router = Router();
router.post('/', tokenVerification, roleCheck(['ADMIN', 'SUPERVISOR']), crearUsuario);
router.get('/', tokenVerification, obtenerUsuarios);
router.get('/:id', tokenVerification, obtenerUsuario);
router.patch('/:id', tokenVerification, roleCheck(['ADMIN', 'SUPERVISOR']), actualizarUsuario);
router.delete('/:id', tokenVerification, roleCheck(['ADMIN', 'SUPERVISOR']), eliminarUsuario);
router.post('/cambiar-password', tokenVerification, cambiarPassword);
export default router;