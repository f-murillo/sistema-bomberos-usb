import { DecodedIdToken } from 'firebase-admin/auth';

declare global{
    namespace Express{
        interface Request{
            /**
            * Informacion del usuario autenticado decodificada desde el token de Firebase.
            * Disponible solo si la ruta pasa por el middleware de verificación.
            */
            user?: DecodedIdToken;
        }
    }
}