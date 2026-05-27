import { Request, Response } from "express";
import { ZodError } from "zod";
import { UsuarioSchema, PasswordChangeSchema, SolicitarResetPasswordSchema } from "@bomberos-usb/shared";
import { db, auth, admin } from "../../config/firebase";
import { registrarAuditoria } from "../../utils/auditoria";
import { NotificacionService } from "../notificaciones/notificaciones.service";
import { EmailService } from "../notificaciones/email.service";

// CRUD para los usuarios
// Crear de un usuario (C)
export const crearUsuario = async (req: Request, res: Response) => {
    try {
        // Validamos los datos con el esquema de usuario
        const validatedData = UsuarioSchema.parse(req.body);
        const requestingUser = (req as any).user;

        if (requestingUser.rol === 'SUPERVISOR' && validatedData.rol && validatedData.rol !== 'BOMBERO' && validatedData.rol !== 'CUENTA_ADMINISTRATIVA') {
            return res.status(403).json({ message: "Los inspectores solo pueden crear usuarios de tipo Bombero o Cuenta Administrativa." });
        }

        if (requestingUser.rol === 'CUENTA_ADMINISTRATIVA' && validatedData.rol && validatedData.rol !== 'BOMBERO') {
            return res.status(403).json({ message: "Las cuentas administrativas solo pueden crear usuarios de tipo Bombero." });
        }

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
        if (error instanceof ZodError) {
            return res.status(400).json({
                errors: error.flatten()
            });
        }

        // Si el error es de tipo Error (algun error del servidor)
        if (error instanceof Error) {
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
        if (!doc.exists) {
            return res.status(404).json({
                message: "Error: usuario no encontrado"
            });
        }

        const requestingUser = (req as any).user;
        const targetUserData = doc.data() as any;

        if (requestingUser.rol === 'SUPERVISOR') {
            const isEditingSelf = requestingUser.uid === id;

            if (!isEditingSelf) {
                const canEditRoles = ['BOMBERO', 'CUENTA_ADMINISTRATIVA'];
                if (!canEditRoles.includes(targetUserData.rol) || (validatedData.rol && !canEditRoles.includes(validatedData.rol))) {
                    return res.status(403).json({ message: "Los inspectores solo pueden editar usuarios de tipo Bombero o Cuenta Administrativa." });
                }
            }

            if (isEditingSelf && validatedData.rol && validatedData.rol !== 'SUPERVISOR') {
                return res.status(403).json({
                    message: "Los inspectores no pueden cambiar su propio rol."
                });
            }

            if (isEditingSelf && validatedData.activo === false) {
                return res.status(403).json({
                    message: "Los inspectores no pueden desactivarse a sí mismos."
                });
            }
        }

        if (requestingUser.rol === 'CUENTA_ADMINISTRATIVA') {
            const isEditingSelf = requestingUser.uid === id;

            if (!isEditingSelf) {
                if (targetUserData.rol !== 'BOMBERO' || (validatedData.rol && validatedData.rol !== 'BOMBERO')) {
                    return res.status(403).json({ message: "Las cuentas administrativas solo pueden editar usuarios de tipo Bombero." });
                }
            }

            if (isEditingSelf) {
                if (validatedData.rol) {
                    return res.status(403).json({
                        message: "Las cuentas administrativas no pueden cambiar su propio rol."
                    });
                }

                if (validatedData.activo !== undefined) {
                    return res.status(403).json({
                        message: "Las cuentas administrativas no pueden cambiar su propio estado."
                    });
                }

                delete validatedData.rango;
                delete validatedData.condicion;
            }
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
        if (error instanceof ZodError) {
            return res.status(400).json({
                errors: error.flatten()
            });
        }

        if (error instanceof Error) {
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
export const eliminarUsuario = async (req: Request, res: Response) => {
    try {
        const { id } = req.params; // El ID es el UID de Firebase
        const userRef = db.collection("usuarios").doc(id);

        // 1. Verificamos si el usuario existe en Firestore
        const doc = await userRef.get();
        if (!doc.exists) {
            return res.status(404).json({
                message: "Error: usuario no encontrado"
            });
        }

        const requestingUser = (req as any).user;
        const targetUserData = doc.data() as any;

        if (requestingUser.rol === 'SUPERVISOR' && targetUserData.rol !== 'BOMBERO' && targetUserData.rol !== 'CUENTA_ADMINISTRATIVA') {
            return res.status(403).json({ message: "Los inspectores solo pueden eliminar usuarios de tipo Bombero o Cuenta Administrativa." });
        }

        if (requestingUser.rol === 'CUENTA_ADMINISTRATIVA' && targetUserData.rol !== 'BOMBERO') {
            return res.status(403).json({ message: "Las cuentas administrativas solo pueden eliminar usuarios de tipo Bombero." });
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
        if (error instanceof Error) {
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

// Restablecimiento de contraseña por correo electrónico — Endpoint público
export const solicitarResetPassword = async (req: Request, res: Response) => {
    try {
        const { email } = SolicitarResetPasswordSchema.parse(req.body);

        // Buscar al usuario en Firestore por su correo
        const snapshot = await db.collection("usuarios").where("email", "==", email).limit(1).get();

        if (snapshot.empty) {
            // Respondemos 200 genérico para no revelar qué correos existen
            return res.status(200).json({
                message: "Si el correo existe, recibirás un enlace de recuperación en tu bandeja de entrada"
            });
        }

        const userDoc = snapshot.docs[0];
        const userId = userDoc.id;

        // Configurar el enlace de restablecimiento que Firebase redirigirá al frontend
        const actionCodeSettings = {
            url: "https://sistema-bomberos-usb.web.app/reset-password",
            handleCodeInApp: true
        };

        // Generar el enlace seguro con Firebase Admin SDK
        const resetLink = await auth.generatePasswordResetLink(email, actionCodeSettings);

        // Construir el HTML del correo con el botón de restablecimiento
        const html = `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
                <div style="background-color: #0f172a; color: white; padding: 24px; text-align: center;">
                    <h1 style="margin: 0; font-size: 20px;">🔐 Restablece tu contraseña</h1>
                </div>
                <div style="padding: 24px; color: #334155;">
                    <p>Recibiste este correo porque solicitaste restablecer la contraseña de tu cuenta en <strong>Sistema Bomberos USB</strong>.</p>
                    <p>Haz clic en el botón de abajo para crear una nueva contraseña:</p>
                    <div style="text-align: center; margin: 32px 0;">
                        <a href="${resetLink}" style="background-color: #2563eb; color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 16px; display: inline-block;">
                            Restablecer contraseña
                        </a>
                    </div>
                    <p style="font-size: 14px; color: #64748b;">Si no solicitaste este cambio, puedes ignorar este correo de forma segura.</p>
                    <p style="font-size: 14px; color: #64748b;">El enlace expirará en 1 hora por razones de seguridad.</p>
                    <p style="font-size: 12px; color: #94a3b8; margin-top: 40px; text-align: center; border-top: 1px solid #e2e8f0; padding-top: 16px;">
                        Este es un mensaje automático generado por el Sistema de Gestión de Bomberos USB. No responda a este correo.
                    </p>
                </div>
            </div>
        `;

        // Enviar el correo usando el servicio de Email ya configurado
        await EmailService.send({
            to: email,
            subject: "🔐 Restablece tu contraseña - Bomberos USB",
            html
        });

        // Registrar la solicitud en auditoría
        await registrarAuditoria('SOLICITAR_RESET_PASSWORD', 'usuarios', userId, "INVITADO", { email });

        res.status(200).json({
            message: "Si el correo existe, recibirás un enlace de recuperación en tu bandeja de entrada"
        });

    } catch (error: any) {
        if (error instanceof ZodError) {
            return res.status(400).json({ errors: error.flatten() });
        }
        console.error("Error al solicitar restablecimiento de contraseña:", error);
        res.status(500).json({ message: "Error interno del servidor" });
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
