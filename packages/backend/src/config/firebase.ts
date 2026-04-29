import * as admin from 'firebase-admin';
import dotenv from 'dotenv';

dotenv.config();

// Si no se encuentran las credenciales de firebase
if(!process.env.GOOGLE_APPLICATION_CREDENTIALS){
    console.error("ERROR: No se encontraron las credenciales");
    process.exit(1);
}

// Conexion a firebase
try{
    // Si no hay ninguna conexion activa
    if(!admin.apps.length){
        // Creamos la conexion 
        admin.initializeApp({
            credential: admin.credential.applicationDefault() // El default busca automaticamente la variable de entorno de las credenciales
        });
        console.log("Conexión exitosa con firebase");
    }
} catch (error){
    console.error("Error al conectar con firebase:", error)
}

// Servicios de base de datos y autenticacion
const db = admin.firestore();
db.settings({ ignoreUndefinedProperties: true });

export { db };
export const auth = admin.auth();
export { admin };
