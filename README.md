# sistema-bomberos-usb
- Sistema desarrollado para la gestión de horarios del cuerpo de bomberos de la USB

- Estructura: __Monorepositorio__

    - Consta de __3 paquetes__ principales, dentro del directorio packages:

        - __backend__
        - __frontend__
        - __shared__: con esquemas y tipos utilizados por el backend y frontend

    - Cada paquete cuenta con su package.json propio

    - Con esto, se puede tener desarrollos independientes del frontend y backend, para luego comunicarlos entre ellos y realizar un único despliegue

## Estructura (solo carpetas y archivos importantes)

sistema-bomberos-usb/
├── package.json              
├── packages/
│   └── shared/               
│       ├── package.json      
│       ├── tsconfig.json
│       └── src/      
│           ├── schemas/
│           └── types/
│       └── tests/
│           ├── schemas/
|   └── backend/
│       ├── package.json      
│       ├── tsconfig.json
│       ├── .env
│       ├── app.ts
│       ├── server.ts
│       └── src/      
│           ├── config/
│           └── modules/
│               └── usuarios/
│       └── tests/
│           ├── config/
│           └── modules/
│               └── usuarios/
|   └── frontend/

