import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

const configOptions = {
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === 'true' || process.env.SMTP_PORT === '465',
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
    },
    family: 4, // <-- Obliga al socket nativo a usar IPv4 e ignorar por completo IPv6
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 10000,
};

const transporter = nodemailer.createTransport(configOptions as any);

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
const FROM_EMAIL = process.env.SMTP_FROM || '"Sistema Bomberos USB" <no-reply@example.com>';

interface EmailOptions {
    to: string | string[];
    subject: string;
    html: string;
}

export const EmailService = {
    /**
     * Envío genérico de correos
     */
    send: async ({ to, subject, html }: EmailOptions) => {
        try {
            // Si no hay configuración, no intentamos enviar (evitar errores en dev sin config)
            if (!process.env.SMTP_USER || process.env.SMTP_USER === 'tu-correo@gmail.com') {
                console.log(`[EMAIL SIMULADO] Para: ${to} | Asunto: ${subject}`);
                return;
            }

            const info = await transporter.sendMail({
                from: FROM_EMAIL,
                to: Array.isArray(to) ? to.join(', ') : to,
                subject,
                html,
            });

            console.log(`Correo enviado: ${info.messageId}`);
            return info;
        } catch (error) {
            console.error("Error al enviar correo:", error);
            // No lanzamos el error para no bloquear el flujo principal del sistema
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
                                <td style="padding: 8px 0; color: #ef4444; font-weight: bold;">${data.minutos} min</td>
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
