import { Router } from "express";
import { actualizarUsuario, crearUsuario, eliminarUsuario, obtenerUsuarios, cambiarPassword, obtenerUsuario, solicitarResetPassword, crearUsuariosEnLote } from "./usuarios.controller";
import { tokenVerification, roleCheck } from '../../middleware/auth.middleware';

const router = Router();
router.post('/', tokenVerification, roleCheck(['ADMIN', 'SUPERVISOR', 'CUENTA_ADMINISTRATIVA']), crearUsuario);
router.post('/bulk', tokenVerification, roleCheck(['ADMIN', 'SUPERVISOR', 'CUENTA_ADMINISTRATIVA']), crearUsuariosEnLote);
router.get('/', tokenVerification, obtenerUsuarios);
router.get('/:id', tokenVerification, obtenerUsuario);
router.patch('/:id', tokenVerification, roleCheck(['ADMIN', 'SUPERVISOR', 'CUENTA_ADMINISTRATIVA']), actualizarUsuario);
router.delete('/:id', tokenVerification, roleCheck(['ADMIN', 'SUPERVISOR', 'CUENTA_ADMINISTRATIVA']), eliminarUsuario);
router.post('/cambiar-password', tokenVerification, cambiarPassword);
router.post('/solicitar-reset-password', solicitarResetPassword);
export default router;