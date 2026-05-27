# sistema-bomberos-usb
- Sistema desarrollado para la gestión de horarios y horas de penalización para el cuerpo de bomberos de la USB

- Estructura: __Monorepositorio__

    - Consta de __3 paquetes__ principales, dentro del directorio packages:

        - __backend__
        - __frontend__
        - __shared__: con esquemas y tipos utilizados por el backend y frontend

    - Cada paquete cuenta con su package.json propio

### Paquete shared (carpeta packages/shared):

- Tiene la estructura base para ser compartida por los paquetes backend y frontend
    - El esquema de los usuarios (carpeta src)
    - Los tipos utilizados por el backend y frontend

### Paquete backend (carpeta packages/backend)

- Tiene la lógica de negocio de la autenticación, el manejo de los arrestos, guardias, y la interacción con la base de datos.

### Paquete frontend (carpeta packages/backend)

- Tiene la interfaz de usuario del sistema.
