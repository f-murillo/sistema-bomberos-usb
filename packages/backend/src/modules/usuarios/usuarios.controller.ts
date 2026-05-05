import { Request, Response } from "express";
import { ZodError } from "zod";
import { UsuarioSchema, PasswordChangeSchema } from "@bomberos-usb/shared";
import { db, auth, admin } from "../../config/firebase";
import { registrarAuditoria } from "../../utils/auditoria";
import { NotificacionService } from "../notificaciones/notificaciones.service";

// CRUD para los usuarios
// Crear de un usuario (C)
export const crearUsuario = async (req: Request, res: Response) => {
    try {
        // Validamos los datos con el esquema de usuario
        const validatedData = UsuarioSchema.parse(req.body);

        // 1. Crear el usuario en Firebase Auth (esto permite que haga login)
        // Por ahora asignamos una contraseña por defecto simple para facilitar el acceso inicial
        const userRecord = await auth.createUser({
            email: validatedData.email,
            emailVerified: true,
            password: '123456', // Contraseña inicial simplificada a petición del usuario
            displayName: validatedData.nombre,
            disabled: !validatedData.activo
        });

        // 2. Asignamos el rol como Custom Claim para que se valide en el token
        await admin.auth().setCustomUserClaims(userRecord.uid, {
            rol: validatedData.rol || "BOMBERO"
        });

        // 3. Guardamos en la colección de usuarios de Firebase usando el UID generado
        const userRef = db.collection("usuarios").doc(userRecord.uid);
        await userRef.set({
            ...validatedData,
            uid: userRecord.uid,
            fechaRegistro: new Date()
        });

        // Guardamos auditoría de la creación
        const adminId = (req as any).user?.uid || "SISTEMA";
        await registrarAuditoria('CREAR_USUARIO', 'usuarios', userRecord.uid, adminId, { email: validatedData.email });

        // Mensaje de exito
        res.status(201).json({
            message: "Usuario registrado exitosamente en Auth y Firestore",
            uid: userRecord.uid
        });

    } catch (error: any) {
        // Manejar errores específicos de Firebase Auth (ej: email ya existe)
        if (error.code === 'auth/email-already-exists') {
            return res.status(400).json({
                message: "Error: El correo electrónico ya está registrado en el sistema"
            });
        }

        // Si el error es de parte de Zod, reportamos ese error
        if(error instanceof ZodError){
            return res.status(400).json({
                errors: error.flatten()
            });
        }

        // Si el error es de tipo Error (algun error del servidor)
        if(error instanceof Error){
            console.error(`Error al crear usuario: ${error.message}`);        
            return res.status(500).json({
                message: "Error interno del servidor al crear usuario"
            });
        }

        // Si el error es de tipo desconocido
        console.error(`Error desconocido: ${error}`);
        res.status(500).json({
            message: "Ocurrió un error inesperado al crear usuario"
        });
    }
};

// Obtener usuarios (R) con paginación
export const obtenerUsuarios = async (req: Request, res: Response) => {
    try {
        const { ultimoId, limite } = req.query;
        const pageSize = limite ? parseInt(limite as string) : 20;

        let query: any = db.collection("usuarios").orderBy("nombre", "asc");

        if (ultimoId) {
            const lastDoc = await db.collection("usuarios").doc(ultimoId as string).get();
            if (lastDoc.exists) {
                query = query.startAfter(lastDoc);
            }
        }

        const snapshot = await query.limit(pageSize).get();
        const usuarios = snapshot.docs.map((doc: any) => {
            const data = doc.data();
            return {
                ...data,
                fechaRegistro: data.fechaRegistro?.toDate ? data.fechaRegistro.toDate() : data.fechaRegistro,
                ultimaActualizacion: data.ultimaActualizacion?.toDate ? data.ultimaActualizacion.toDate() : data.ultimaActualizacion
            }
        });
        res.status(200).json(usuarios);

    } catch (error: any) {
        console.error("Error al obtener usuarios:", error);
        res.status(500).json({ message: "Error al obtener los usuarios" });
    }
};

// Obtener un usuario por ID (R)
export const obtenerUsuario = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const userDoc = await db.collection("usuarios").doc(id).get();

        if (!userDoc.exists) {
            return res.status(404).json({ message: "Usuario no encontrado" });
        }

        const data = userDoc.data();
        const usuario = {
            ...data,
            fechaRegistro: data?.fechaRegistro?.toDate ? data.fechaRegistro.toDate() : data?.fechaRegistro,
            ultimaActualizacion: data?.ultimaActualizacion?.toDate ? data.ultimaActualizacion.toDate() : data?.ultimaActualizacion
        };

        res.status(200).json(usuario);
    } catch (error: any) {
        console.error("Error al obtener usuario:", error);
        res.status(500).json({ message: "Error al obtener el usuario" });
    }
};

// Actualizar usuario (U)
export const actualizarUsuario = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        // Validamos que los datos enviados cumplan parcialmente el esquema. El partial() de Zod permite que los campos sean opcionales
        const validatedData = UsuarioSchema.partial().parse(req.body);
        const userRef = db.collection("usuarios").doc(id);

        // Verificamos si el usuario existe antes de intentar actualizar
        const doc = await userRef.get();
        if(!doc.exists){
            return res.status(404).json({
                message: "Error: usuario no encontrado"
            });
        }
        
        // 1. Sincronizamos con Firebase Auth si se modifican campos relevantes
        if (validatedData.nombre !== undefined || validatedData.activo !== undefined || validatedData.rol !== undefined || validatedData.email !== undefined) {
            try {
                console.log(`Intentando actualizar usuario ${id}. Datos:`, validatedData);

                // Verificación de redundancia: ¿el email ya existe en Firestore para otro usuario?
                if (validatedData.email) {
                    const emailCheck = await db.collection("usuarios")
                        .where("email", "==", validatedData.email)
                        .get();
                    
                    const otherUser = emailCheck.docs.find(doc => doc.id !== id);
                    if (otherUser) {
                        return res.status(400).json({
                            message: "Error: Este correo ya está registrado en el sistema por otro usuario"
                        });
                    }
                }

                // Actualizamos perfil básico en Firebase Auth
                const authUpdate: any = {};
                if (validatedData.nombre !== undefined) authUpdate.displayName = validatedData.nombre;
                if (validatedData.email !== undefined) authUpdate.email = validatedData.email;
                if (validatedData.activo !== undefined) authUpdate.disabled = !validatedData.activo;

                if (Object.keys(authUpdate).length > 0) {
                    await auth.updateUser(id, authUpdate);
                }

                // Actualizamos Claims si cambió el rol
                if (validatedData.rol !== undefined) {
                    await admin.auth().setCustomUserClaims(id, {
                        rol: validatedData.rol
                    });
                }
            } catch (authError: any) {
                // Manejo de errores específicos de Auth
                if (authError.code === 'auth/email-already-exists') {
                    return res.status(400).json({
                        message: "Error: El correo ya está en uso por otro usuario"
                    });
                }
                
                // Si el usuario no existe en Auth (pero sí en Firestore), lo ignoramos para seguir con Firestore
                if (authError.code !== 'auth/user-not-found') {
                    throw authError;
                }
            }
        }

        // 2. Actualizamos en Firestore
        await userRef.update({
            ...validatedData,
            fechaActualizacion: new Date()
        });
        
        // Guardamos auditoría
        const adminId = (req as any).user?.uid || "SISTEMA";
        await registrarAuditoria('ACTUALIZAR_USUARIO', 'usuarios', id, adminId, { fields: Object.keys(validatedData) });

        // Notificar al usuario que sus datos fueron actualizados
        await NotificacionService.enviar({
            usuarioId: id,
            titulo: "Perfil Actualizado",
            mensaje: "Un administrador ha actualizado la información de tu cuenta.",
            tipo: "SISTEMA"
        });

        res.status(200).json({
            message: "Usuario actualizado con éxito"
        });

    } catch (error: any) {
        // Manejo de errores de validación de Zod
        if(error instanceof ZodError){
            return res.status(400).json({
                errors: error.flatten()
            });
        }

        if(error instanceof Error){
            console.error(`Error al actualizar usuario: ${error.message}`);
            return res.status(500).json({
                message: "Error interno del servidor al actualizar usuario"
            });
        }
        // Si ocurre un error inesperado
        res.status(500).json({
            message: "Ocurrió un error inesperado al actualizar usuario"
        });
    }
};

// Eliminar usuario (D)
export const eliminarUsuario = async(req: Request, res: Response) =>{
    try {
        const { id } = req.params; // El ID es el UID de Firebase
        const userRef = db.collection("usuarios").doc(id);
    
        // 1. Verificamos si el usuario existe en Firestore
        const doc = await userRef.get();
        if(!doc.exists){
            return res.status(404).json({
                message: "Error: usuario no encontrado"
            });
        }

        // 2. Eliminar de Firebase Auth (esto impide que vuelva a iniciar sesión)
        try {
            await auth.deleteUser(id);
        } catch (authError: any) {
            // Si el usuario no existe en Auth pero sí en Firestore, seguimos con el borrado de Firestore
            if (authError.code !== 'auth/user-not-found') {
                throw authError;
            }
        }

        // 3. Eliminar de Firestore
        await userRef.delete();
        
        const adminId = (req as any).user?.uid || "SISTEMA";
        await registrarAuditoria('ELIMINAR_USUARIO', 'usuarios', id, adminId);

        res.status(200).json({
            message: "Usuario eliminado con éxito de Auth y Firestore"
        });

    } catch (error: unknown) {
        if(error instanceof Error){
            console.error(`Error al eliminar usuario: ${error.message}`);
            return res.status(500).json({
                message: "Error interno del servidor al eliminar usuario"
            });
        
        }
        // En caso de un error inesperado
        res.status(500).json({
            message: "Ocurrió un error inesperado al eliminar usuario"
        });
    }
};

// Cambio de contraseña para el usuario autenticado
export const cambiarPassword = async (req: Request, res: Response) => {
    try {
        const { currentPassword, newPassword } = PasswordChangeSchema.parse(req.body);
        const userId = (req as any).user?.uid;

        if (!userId) {
            return res.status(401).json({ message: "No autorizado" });
        }

        // 1. Obtener el email del usuario para verificar la contraseña actual
        const userDoc = await db.collection("usuarios").doc(userId).get();
        if (!userDoc.exists) {
            return res.status(404).json({ message: "Usuario no encontrado" });
        }
        const email = userDoc.data()?.email;

        // 2. Verificar la contraseña actual mediante la API de Google (Simulando un login)
        const API_KEY = process.env.FIREBASE_WEB_API_KEY;
        const url = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`;

        const verifyResponse = await fetch(url, {
            method: "POST",
            body: JSON.stringify({
                email,
                password: currentPassword,
                returnSecureToken: true
            }),
            headers: { 'Content-Type': 'application/json' }
        });

        if (!verifyResponse.ok) {
            return res.status(401).json({ message: "La contraseña actual es incorrecta" });
        }

        // 3. Si la verificación fue exitosa, actualizamos a la nueva contraseña
        await auth.updateUser(userId, {
            password: newPassword
        });

        // Registramos en auditoría
        await registrarAuditoria('CAMBIAR_PASSWORD', 'usuarios', userId, userId);

        res.status(200).json({ message: "Contraseña actualizada exitosamente" });

    } catch (error: any) {
        if (error instanceof ZodError) {
            return res.status(400).json({ errors: error.flatten() });
        }
        console.error("Error al cambiar contraseña:", error);
        res.status(500).json({ message: "Error interno del servidor" });
    }
};