import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { UsuarioSchema } from '@bomberos-usb/shared'; // esto es solo para verificar que este bien conectado el paquete shared con los demas
import usuarioRoutes from './modules/usuarios/usuarios.routes';
import authRoutes from './modules/auth/auth.routes';
import guardiaRoutes from './modules/guardias/guardias.routes';
import notificacionRoutes from './modules/notificaciones/notificaciones.routes';
import auditoriaRoutes from './modules/auditoria/auditoria.routes';

const app = express();

// Middlewares de seguridad y base
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use('/usuarios', usuarioRoutes);
app.use('/auth', authRoutes);
app.use('/guardias', guardiaRoutes);
app.use('/notificaciones', notificacionRoutes);
app.use('/auditoria', auditoriaRoutes);

// Ruta de prueba
app.get('/health', (req,res) =>{
    res.json({status: 'ok', message: 'Sistema en línea'})
});

export default app;