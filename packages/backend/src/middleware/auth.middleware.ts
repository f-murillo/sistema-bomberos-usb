import {Request, Response, NextFunction} from 'express';
import {admin} from '../config/firebase';

export const tokenVerification = async(req: Request, res: Response, next: NextFunction) =>{
    const header = req.headers.authorization; // Header Authorization es a donde se enviaran las credenciales

    if(!header || !header.startsWith('Bearer ')){ // Beares es una convencion de OAuth2. Si empieza por Bearer, el token tiene permiso
        return res.status(401).json({
            message: "No autorizado: Token faltante"
        });
    }

    const token = header.split(' ')[1]; // Con split creamos un array ['Bearer', token]. Con el [1] solo nos quedamos con el codigo del token

    try{
        // Validamos el token con Firebase Admin (con el verifyIdToken)
        const decodedToken = await admin.auth().verifyIdToken(token); 
        // Inyectamos la info del usuario en el objeto request para que los controladores siguientes sepan quien esta operando
        req.user = decodedToken;
        // Si todo salio bien, pasamos al siguiente paso
        next();

    } catch(error){
        console.error("Error al verificar token: ", error);
        res.status(401).json({
            message: "Token inválido o expirado"
        });
    }
};

export const roleCheck = (allowedRoles: string[]) => {
    return (req: Request, res: Response, next: NextFunction) => {
        // req.user has the decoded token
        const user = req.user as any;
        if (!user || (!allowedRoles.includes(user.rol) && !allowedRoles.includes(user.role))) {
            return res.status(403).json({
                message: "Acceso denegado: No tienes los permisos necesarios para realizar esta acción."
            });
        }
        next();
    };
};