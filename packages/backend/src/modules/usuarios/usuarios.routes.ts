import { Router } from "express";
import { actualizarUsuario, crearUsuario, eliminarUsuario, obtenerUsuarios, cambiarPassword } from "./usuarios.controller";
import { tokenVerification, roleCheck } from '../../middleware/auth.middleware';

const router = Router();
router.post('/', tokenVerification, roleCheck(['ADMIN']), crearUsuario);
router.get('/', tokenVerification, obtenerUsuarios);
router.patch('/:id', tokenVerification, roleCheck(['ADMIN']), actualizarUsuario);
router.delete('/:id', tokenVerification, roleCheck(['ADMIN']), eliminarUsuario);
router.post('/cambiar-password', tokenVerification, cambiarPassword);
export default router;