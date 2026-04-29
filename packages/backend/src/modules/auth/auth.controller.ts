import { Request, Response } from 'express';

// Para el login
export const loginUsuario = async(req: Request, res: Response) =>{
    try{
        const { email, password } = req.body;

        if(!email || !password){
            return res.status(400).json({
                message: "El correo electrónico y la contraseña son requeridos"
            });
        }

        // URL de la REST API de Firebase Auth 
        const API_KEY = process.env.FIREBASE_WEB_API_KEY;
        const url = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`;

        // Hacemos la peticion a Google
        const response = await fetch(url, {
            method: "POST",
            body: JSON.stringify({
                email,
                password,
                returnSecureToken: true
            }),
            headers: {
                'Content-Type': 'application/json'
            }
        });

        const data = await response.json();

        // Si google retorna algun error (por ejemplo, credenciales invalidas)
        if(!response.ok){
            return res.status(401).json({
                message: "Credenciales inválidas",
                error: data.error.message,
            });
        }

        // Mensaje de exito
        res.status(200).json({
            message: "Login exitoso",
            token: data.idToken,
            expiresIn: data.ExpiresIn,
            localId: data.localID
        });

    } catch(error){
        console.log(`Error en el login: ${error}`);
        return res.status(500).json({
            message: "Error interno del servidor en el login"
        });
    }
};