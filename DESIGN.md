# Documento de Diseño de Software

**Proyecto**: Sistema de Gestión de horarios para el cuerpo de bomberos de la USB

**Propietario**: Cuerpo de Bomberos de la USB

**Estado**: En desarrollo

**Fecha de última revisión**: 10-04-2026

---

## 1. Introducción y Objetivos

### 1.1 Propósito

El objetivo de este sistema es digitalizar y automatizar la gestión de horarios, asignaciones y cumplimiento de guardias para el cuerpo de bomberos de la Universidad Simón Bolívar, eliminando procesos manuales y errores de coordinación.

### 1.2 Objetivos Principales

- **Centralización**: un único lugar para manejar el estado de las guardias.

- **Transparencia**: contar con un registro inmutable de quiénes cumplieron sus turnos.

- **Automatización**: implementación de un algoritmo de planificación que evite fatiga y colisiones de horarios.

- **Inmediatez**: contar con notificaciones y avisos por correo sobre asignaciones, estados y cambios en las guardias.

---

## 2. Arquitectura del Sistema

### 2.1 Tecnologías utilizadas

- **Frontend**: React (Vite) + TypeScript + TanStack Query.

- **Backend**: Node.js (Express) + TypeScript.

- **Base de Datos**: Firebase Firestore (NoSQL).

- **Autenticación**: Firebase Auth (Google & Email).

- **Infraestructura**: Monorepo gestionado con pnpm.

- **Despliegue**: Google Cloud Run o Render (Backend) y Firebase Hosting (Frontend).

### 2.2 Estructuras de datos (entidades del sistema)

- **Usuario**: UID, nombre, email, rol (ADMIN, SUPERVISOR, BOMBERO), activo (booleano).

- **Guardia**: ID, bomberoId, fechaInicio, fechaFin, estado (PENDIENTE, COMPLETADA, etc.).

- **Auditoría**: para llevar un registro de acciones administrativas sensibles.

---

## 3. Requerimientos Funcionales (RF)

- **RF1 - Control de Acceso**: Solo usuarios pre-registrados por un administrador pueden iniciar sesión y acceder al sistema.

- **RF2 - Gestión de Guardias**: Los supervisores pueden crear guardias manuales o ejecutar el algoritmo automático.

- **RF3 - Edición de Guardias**: Los supervisores pueden editar o eliminar las guardias de forma manual.

- **RF4 - Validación de Tiempo**: Un bombero solo puede marcar una guardia como "completada" si la hora actual >= hora de inicio.

- **RF5 - Notificaciones**: El sistema debe enviar un correo y una notificación push 24h antes de cada guardia.

---

## 4. Requerimientos No Funcionales (RNF)

- **RNF1 - Seguridad**: Toda acción de escritura en la base de datos debe ser validada por esquemas de Zod y reglas de seguridad de Firestore.

- **RNF2 - Persistencia**: La sesión del usuario debe mantenerse activa hasta que el usuario decida cerrarla manualmente o se cumpla cierto tiempo sin ingresar al sistema.

- **RNF3 - Disponibilidad**: El sistema debe funcionar en dispositivos móviles (vía navegador) con tiempos de carga idealmente menores a 2 segundos.

---

## 5. Planificación de Fases

| Fase    | Descripción                                              | Estado         |
| ------- | -------------------------------------------------------- | -------------- |
| Fase 1  | Definición de los tipos compartidos y validaciones       | **Completado** |
| Fase 2  | Desarrollo de la parte base del backend                  | **Pendiente**  |
| Fase 3  | Desarrollo de la lógica de las guardias                  | **Pendiente**  |
| Fase 4  | Implementación del algoritmo de planificación automática | **Pendiente**  |
| Fase 5  | Implementación de notificaciones y envíos de correos     | **Pendiente**  |
| Fase 6  | Tests de integración y calidad                           | **Pendiente**  |
| Fase 7  | Desarrollo de la parte base del frontend                 | **Pendiente**  |
| Fase 8  | Integración de frontend y backend                        | **Pendiente**  |
| Fase 9  | Finalización del frontend                                | **Pendiente**  |
| Fase 10 | Fase de pruebas de comportamiento con clientes           | **Pendiente**  |
| Fase 11 | Despliegue y pruebas en producción                       | **Pendiente**  |

---

## 6. Consideraciones de Seguridad y Auditoría

Cualquier cambio en la base de datos relacionado con la eliminación de usuarios o modificación de guardias pasadas debe quedar registrado en la colección de auditoria, incluyendo el timestamp y el uid del responsable.

## 7. Credenciales

Las credenciales se encuentran en la carpeta secret, donde está la credencial de firebase para poder usarlo en el proyecto
