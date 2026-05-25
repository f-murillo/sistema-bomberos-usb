import { google } from 'googleapis';
import dotenv from 'dotenv';

dotenv.config();

const OAuth2 = google.auth.OAuth2;

// Inicializamos el cliente de autenticación de Google con tus credenciales
const oauth2Client = new OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    "https://developers.google.com/oauthplayground" // URL requerida por Google usada en el Playground
);

oauth2Client.setCredentials({
    refresh_token: process.env.GOOGLE_REFRESH_TOKEN
});

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
const FROM_EMAIL = process.env.SMTP_FROM || '"Sistema Bomberos USB" <bomberos.usb.gestion@gmail.com>';

interface EmailOptions {
    to: string | string[];
    subject: string;
    html: string;
}

export const EmailService = {
    /**
     * Envío genérico de correos a través de la API de Gmail (HTTPS)
     */
    send: async ({ to, subject, html }: EmailOptions) => {
        try {
            // Validación de respaldo por si falta configuración en local (Dev)
            if (!process.env.GOOGLE_REFRESH_TOKEN) {
                console.log(`[EMAIL SIMULADO] Para: ${to} | Asunto: ${subject}`);
                return;
            }

            // Inicializamos el servicio de Gmail
            const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

            // Formateamos los destinatarios si viene un array
            const targetEmails = Array.isArray(to) ? to.join(', ') : to;

            // El protocolo de Gmail exige codificar los asuntos UTF-8 en Base64 para evitar caracteres rotos (acentos, emojis)
            const utf8Subject = `=?utf-8?B?${Buffer.from(subject).toString('base64')}?=`;

            // Construimos la estructura del estándar MIME de correo electrónico
            const messageParts = [
                `From: ${FROM_EMAIL}`,
                `To: ${targetEmails}`,
                'Content-Type: text/html; charset=utf-8',
                'MIME-Version: 1.0',
                `Subject: ${utf8Subject}`,
                '',
                html
            ];
            const message = messageParts.join('\n');

            // Gmail API requiere que todo el paquete MIME viaje en un Base64 seguro para URLs (web safe)
            const encodedMessage = Buffer.from(message)
                .toString('base64')
                .replace(/\+/g, '-')
                .replace(/\//g, '_')
                .replace(/=+$/, '');

            // Envío directo vía HTTP POST (Puerto 443 - Imposible de bloquear por Render)
            const res = await gmail.users.messages.send({
                userId: 'me',
                requestBody: {
                    raw: encodedMessage,
                },
            });

            console.log(`Correo enviado exitosamente vía API de Gmail ID: ${res.data.id}`);
            return res.data;
        } catch (error) {
            console.error("Error crítico al enviar correo por API de Google:", error);
            // Mantenemos tu filosofía de diseño: no bloqueamos el flujo principal si falla el correo
        }
    },

    /**
     * Notificación de Infracción Asignada
     */
    enviarNotificacionArresto: async (data: {
        destinatarioEmail: string | string[];
        bomberoNombre: string;
        registradoPorNombre: string;
        minutos: number;
        motivo: string;
        fecha: string;
    }) => {
        const html = `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
                <div style="background-color: #0f172a; color: white; padding: 24px; text-align: center;">
                    <h1 style="margin: 0; font-size: 20px;">🚨 Comprobante de Infracción</h1>
                </div>
                <div style="padding: 24px; color: #334155;">
                    <p>Se ha registrado una nueva infracción en el sistema con los siguientes detalles:</p>
                    
                    <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin: 20px 0;">
                        <table style="width: 100%; border-collapse: collapse;">
                            <tr>
                                <td style="padding: 8px 0; color: #64748b; font-size: 14px; width: 40%;">Funcionario:</td>
                                <td style="padding: 8px 0; color: #0f172a; font-weight: bold;">${data.bomberoNombre}</td>
                            </tr>
                            <tr>
                                <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Asignado por:</td>
                                <td style="padding: 8px 0; color: #0f172a;">${data.registradoPorNombre}</td>
                            </tr>
                            <tr>
                                <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Minutos:</td>
                                <td style="padding: 8px 0; color: #offset4444; color: #ef4444; font-weight: bold;">${data.minutos} min</td>
                            </tr>
                            <tr>
                                <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Motivo:</td>
                                <td style="padding: 8px 0; color: #0f172a;">${data.motivo}</td>
                            </tr>
                            <tr>
                                <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Fecha de Guardia:</td>
                                <td style="padding: 8px 0; color: #0f172a;">${data.fecha}</td>
                            </tr>
                        </table>
                    </div>

                    <div style="text-align: center; margin-top: 32px;">
                        <a href="${FRONTEND_URL}/arrestos" style="background-color: #2563eb; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: bold; display: inline-block;">
                            Ver detalles en el sistema
                        </a>
                    </div>
                    
                    <p style="font-size: 12px; color: #94a3b8; margin-top: 40px; text-align: center; border-top: 1px solid #e2e8f0; padding-top: 16px;">
                        Este es un mensaje automático generado por el Sistema de Gestión de Bomberos USB. No responda a este correo.
                    </p>
                </div>
            </div>
        `;

        return EmailService.send({
            to: data.destinatarioEmail,
            subject: `🚨 Notificación de Arresto - ${data.bomberoNombre}`,
            html
        });
    },

    /**
     * Notificación de Pago de Arresto
     */
    enviarNotificacionPago: async (data: {
        destinatarioEmail: string | string[];
        bomberoNombre: string;
        minutos: number;
        motivo: string;
        fecha: string;
        pagoDoble?: boolean;
    }) => {
        const html = `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
                <div style="background-color: #059669; color: white; padding: 24px; text-align: center;">
                    <h1 style="margin: 0; font-size: 20px;">✅ Comprobante de Pago de Arresto</h1>
                </div>
                <div style="padding: 24px; color: #334155;">
                    <p>Se ha registrado un nuevo pago de arresto en el sistema:</p>
                    
                    <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin: 20px 0;">
                        <table style="width: 100%; border-collapse: collapse;">
                            <tr>
                                <td style="padding: 8px 0; color: #64748b; font-size: 14px; width: 40%;">Funcionario:</td>
                                <td style="padding: 8px 0; color: #0f172a; font-weight: bold;">${data.bomberoNombre}</td>
                            </tr>
                            <tr>
                                <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Minutos Pagados:</td>
                                <td style="padding: 8px 0; color: #059669; font-weight: bold;">${data.minutos} min ${data.pagoDoble ? '(Pago Doble)' : ''}</td>
                            </tr>
                            <tr>
                                <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Motivo/Concepto:</td>
                                <td style="padding: 8px 0; color: #0f172a;">${data.motivo}</td>
                            </tr>
                            <tr>
                                <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Fecha:</td>
                                <td style="padding: 8px 0; color: #0f172a;">${data.fecha}</td>
                            </tr>
                        </table>
                    </div>

                    <div style="text-align: center; margin-top: 32px;">
                        <a href="${FRONTEND_URL}/arrestos" style="background-color: #059669; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: bold; display: inline-block;">
                            Ver mi balance actualizado
                        </a>
                    </div>
                    
                    <p style="font-size: 12px; color: #94a3b8; margin-top: 40px; text-align: center; border-top: 1px solid #e2e8f0; padding-top: 16px;">
                        Este es un mensaje automático generado por el Sistema de Gestión de Bomberos USB. No responda a este correo.
                    </p>
                </div>
            </div>
        `;

        return EmailService.send({
            to: data.destinatarioEmail,
            subject: `✅ Pago de Arresto Registrado - ${data.bomberoNombre}`,
            html
        });
    }
};