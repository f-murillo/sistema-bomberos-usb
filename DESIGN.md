# Documento de Diseño de Software

**Proyecto**: Sistema de Gestión de horas de arrestos y guardias para el cuerpo de bomberos de la USB

**Propietario**: Cuerpo de Bomberos de la USB

**Estado**: En desarrollo

**Fecha de última revisión**: 27-05-2026

---

## 1. Introducción y Objetivos

### 1.1 Propósito

El objetivo de este sistema es digitalizar y automatizar la gestión de horas de penalización (arrestos) por faltas a guardias, así como la automatización de horarios, asignaciones y cumplimiento de guardias para el cuerpo de bomberos de la Universidad Simón Bolívar, eliminando procesos manuales y errores de coordinación.

### 1.2 Objetivos Principales

- **Centralización**: un único lugar para manejar el estado de las horas de penalización y guardias.

- **Transparencia**: contar con un registro inmutable de cuántas horas de servicio pendientes tienen y quiénes cumplieron sus turnos.

- **Inmediatez**: contar con notificaciones y avisos por correo sobre asignaciones de penalizaciones, pagos realizados y estados de guardias.

---

## 2. Arquitectura del Sistema

### 2.1 Tecnologías utilizadas

- **Frontend**: React (Vite) + TypeScript + TanStack Query.

- **Backend**: Node.js (Express) + TypeScript.

- **Base de Datos**: Firebase Firestore (NoSQL).

- **Autenticación**: Firebase Auth (Google & Email).

- **Infraestructura**: Monorepo gestionado con pnpm.

- **Despliegue**: Render (Backend) y Firebase Hosting (Frontend).

### 2.2 Estructuras de datos iniciales (una idea de cómo se verán las entidades del sistema)

- **Usuario**: puede ser de tipo administrador del sistema, inspector, cuenta administrativa y bombero. Todos cuentan con un nombre, email, teléfono, y un token fcm (para notificaciones push).    
  - Los usuarios de tipo bombero cuentan con un rango y condicion (regular o no regular).
    
- **Arresto**: para llevar un control de las horas de penalización para cada bombero.

- **Guardia**: para llevar un control de las guardias de cada bombero.

- **Auditoría**: para llevar un registro de acciones administrativas sensibles.

---

## 3. Requerimientos Funcionales (RF)

- **RF1 - Control de Acceso**: Solo usuarios pre-registrados por un administrador, un inspector, o una cuenta administrativa pueden iniciar sesión y acceder al sistema.

- **RF2 - Gestión de Usuarios**: Los administradores del sistema, inspectores y cuentas administrativas del sistema pueden crear, cuentas.

- **RF2.1 - Gestión de Usuarios - Administrador del Sistema**: Los administradores del sistema crear, editar y eliminar cuentas de tipo administrador, inspector, cuenta adinistrativa y bombero.

- **RF2.2 - Gestión de Usuarios - Inspector**: Los inspectores pueden crear, editar y eliminar cuentas de tipo cuenta administrativa y bombero.

- **RF2.3 - Gestión de Usuarios - Cuenta Administrativa**: Las cuentas administrativas pueden crear, editar y eliminar cuentas de tipo bombero.

- **RF3 - Gestión de Arrestos**: Los inspectores y bomberos pueden asignar horas de arrestos a cualquier bombero.

- **RF3.1 - Notificación de Arresto Asignado**: Al asignarse un arresto, los inspectores, así como el bombero que asignó el arresto y el bombero que lo recibió deben recibir un correo electrónico con el comprobante del arresto.

- **RF3.2 - Edición de Arrestos**: Los inspectores y bomberos que hayan asignado arrestos pueden editar o eliminar los mismos de forma manual.

- **RF3.3 - Visualización de Arrestos**: Los inspectores y bomberos pueden visualizar los arrestos que hayan asignado. Los bomberos pueden visualizar los arrestos que han recibido.

- **RF3.4- Pago de Arrestos**: Los inspectores y bomberos pueden visualizar los arrestos que hayan asignado. Los bomberos pueden visualizar los arrestos que han recibido.

- **RF3.5 - Notificación de Pago de Arresto**: Al pagarse un arresto, los inspectores, así como el bombero que reportó el pago deben recibir un correo electrónico con el comprobante del pago.

- **RF4- Visualización de Balance Personal**: Los bomberos pueden visualizar sus horas de servicio pendiente por mes (la cuota máxima de horas al mes por usuario varía dependiendo del tipo de bombero).

- **RF5- Visualización del balance general**: Los inspectores, cuentas administrativas y bomberos pueden visualizar el balance general de horas de servicio pendientes de todos los bombero. Los inspectores y cuentas administrativas pueden descargar un archivo Excel con el balance.

- **RF6- Gestión de Guardias**: Los inspectores pueden crear guardias para los bomberos.

- **RF7- Edición de Guardias**: Los inspectores pueden editar o eliminar las guardias de forma manual. 

- **RF8 - Notificación de Guardias Asignadas**: El sistema debe enviar una notificación al bombero cuando se le haya asignado una guardia, así como una notificación de recordatorio el día de la guardia.

- **RF9 - Notificación de Guardia Completada**: Si un inspector marca una guardia como completa, el sistema debe enviar una notificación al bombero.

---

## 4. Requerimientos No Funcionales (RNF)

- **RNF1 - Seguridad**: Toda acción de escritura en la base de datos debe ser validada por esquemas de Zod y reglas de seguridad de Firestore.

- **RNF2 - Persistencia**: La sesión del usuario debe mantenerse activa hasta que el usuario decida cerrarla manualmente o se cumpla cierto tiempo sin ingresar al sistema.

- **RNF3 - Disponibilidad**: El sistema debe funcionar en dispositivos móviles (vía navegador) con tiempos de carga óptimos.

---

## 5. Planificación de Fases

| Fase    | Descripción                                           | Estado         |
| ---------| -------------------------------------------------------| ----------------|
| Fase 1  | Definición de los tipos compartidos y validaciones    | **Completado** |
| Fase 2  | Desarrollo de la parte base del backend               | **Completado** |
| Fase 3  | Desarrollo de la lógica de las horas de arrestos      | **Completado** |
| Fase 4  | Desarrollo de la lógica de las guardias               | **Completado** |
| Fase 5  | Implementación de notificaciones y envíos de correos  | **Completado** |
| Fase 6  | Tests de integración y calidad                        | **Completado** |
| Fase 7  | Desarrollo de la parte base del frontend              | **Completado** |
| Fase 8  | Integración de frontend y backend                     | **Completado** |
| Fase 9  | Finalización del frontend                             | **Completado** |
| Fase 10 | Despliegue y pruebas en producción                    | **Completado** |
| Fase 11 | Fase de pruebas con el cliente y correcciones finales | **Pendiente**  |

---

## 6. Consideraciones de Seguridad y Auditoría

Cualquier cambio en la base de datos relacionado con la eliminación de usuarios o modificación de arrestos y guardias debe quedar registrado en la colección de auditoria, incluyendo el timestamp y el uid del responsable.

## 7. Credenciales

Las credenciales se encuentran en la carpeta secret, donde está la credencial de firebase para poder usarlo en el proyecto
