import { Router } from 'express';
import { loginUsuario } from './auth.controller';

const router = Router();

router.post('/login', loginUsuario);

export default router;