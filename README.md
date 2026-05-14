<div align="center">

# OrdenYa

### Sistema de Gestión de Órdenes de Trabajo en Tiempo Real

**Trabajo de Fin de Grado** — Desarrollo de Aplicaciones Web

Laravel 12 · React 19 · MySQL 8 · WebSockets (Reverb) · PWA

[![PHP](https://img.shields.io/badge/PHP-8.2-777BB4?logo=php&logoColor=white)](https://www.php.net)
[![Laravel](https://img.shields.io/badge/Laravel-12-FF2D20?logo=laravel&logoColor=white)](https://laravel.com)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)](https://react.dev)
[![Vite](https://img.shields.io/badge/Vite-7-646CFF?logo=vite&logoColor=white)](https://vitejs.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![MySQL](https://img.shields.io/badge/MySQL-8.0-4479A1?logo=mysql&logoColor=white)](https://www.mysql.com)

**Demostración en producción:** [orden-ya.vercel.app](https://orden-ya.vercel.app)

</div>

---

## Tabla de contenidos

1. [Resumen del proyecto](#resumen-del-proyecto)
2. [Objetivos](#objetivos)
3. [Arquitectura](#arquitectura)
4. [Stack tecnológico](#stack-tecnológico)
5. [Estructura del repositorio](#estructura-del-repositorio)
6. [Requisitos previos](#requisitos-previos)
7. [Instalación local](#instalación-local)
8. [Credenciales de demostración](#credenciales-de-demostración)
9. [Flujo de uso por rol](#flujo-de-uso-por-rol)
10. [Comunicación en tiempo real](#comunicación-en-tiempo-real)
11. [Aplicación instalable (PWA)](#aplicación-instalable-pwa)
12. [Despliegue en la nube](#despliegue-en-la-nube)
13. [Seguridad](#seguridad)
14. [Comandos útiles](#comandos-útiles)
15. [Resolución de problemas](#resolución-de-problemas)
16. [Lista de comprobación para la defensa](#lista-de-comprobación-para-la-defensa)
17. [Licencia y autoría](#licencia-y-autoría)

---

## Resumen del proyecto

**OrdenYa** es una aplicación web full-stack diseñada para digitalizar la gestión completa del ciclo de vida de las órdenes de trabajo en una empresa industrial. Sustituye los partes en papel y las hojas de cálculo dispersas por un sistema centralizado, multi-rol y con sincronización en tiempo real entre todos los puestos de trabajo.

El sistema modela el flujo real de fábrica: una orden se descompone en **departamentos** (Taller, Instalación), cada uno con **fases secuenciales** (Cortar, Soldar, Pintar, etc.) y **trabajadores asignados** con cuotas individuales de piezas. Los operarios fichan tiempo en cada fase mediante cronómetro o escaneo de código QR; los supervisores aprueban los trabajos completados; los administradores gestionan usuarios, piezas y reciben analíticas agregadas.

La aplicación es **instalable como Progressive Web App** en móvil, tablet o escritorio, y funciona con experiencia offline-first en las pantallas operativas.

---

## Objetivos

| Nº | Objetivo                                                                      | Cumplimiento                                                                  |
| --- | ----------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| O1  | Modelar el dominio de órdenes industriales con departamentos, fases y cuotas | Esquema en 3NF/BCNF con entidades débiles para asociaciones con atributos    |
| O2  | Implementar autenticación robusta con tres roles diferenciados               | Sanctum Bearer + middleware `role:*` por endpoint                           |
| O3  | Soportar fichaje de tiempo mediante cronómetro, entrada manual y escaneo QR  | `WorkSession` con play/pause/stop, manual session y acceso a cámara        |
| O4  | Sincronizar datos entre usuarios en tiempo real sin recargar                  | Laravel Reverb (WebSockets) + Echo + protocolo Pusher                         |
| O5  | Ofrecer una experiencia mobile-first instalable como aplicación nativa       | PWA con manifest, service worker e icono propio en el home                    |
| O6  | Generar analíticas de productividad por usuario y orden                      | KPIs, gráficos de tendencia, donut por departamento, ranking de trabajadores |
| O7  | Desplegar en infraestructura cloud gratuita y reproducible                    | Render (backend Docker) + Vercel (SPA) + Clever Cloud (MySQL)                 |

---

## Arquitectura

```
+---------------------+    HTTPS / WSS     +---------------------+    TCP 3306    +---------------------+
|   Navegador / PWA   | <----------------> |  Backend Laravel 12 | <------------> |  MySQL 8 (Clever)   |
|   React 19 + Vite   |   REST + Sanctum   |  PHP 8.2 + Reverb   |     PDO        |  Esquema relacional |
|   SPA + Service WK  |                    |  WebSocket :8080    |                |  10 entidades       |
+---------------------+                    +---------------------+                +---------------------+
        |                                            |
        |  Eventos broadcast                         |
        v                                            v
+---------------------+                    +---------------------+
|  Canal privado      |                    |  AuditLog +         |
|  App.Models.User.id |                    |  Notification queue |
+---------------------+                    +---------------------+
```

**Patrón arquitectónico:** SPA desacoplada + API REST stateless + canal WebSocket para eventos push.

- **Backend** estructurado en capas: Controllers (HTTP) → Models (Eloquent / dominio) → Migrations (esquema).
- **Frontend** organizado por responsabilidades: Pages → Services (axios) → Context (estado global) → Components.

Los diagramas formales (entidad-relación, casos de uso, clases UML) se encuentran en el capítulo 4 de la memoria del TFG.

---

## Stack tecnológico

### Backend

| Capa              | Tecnología             | Justificación                                            |
| ----------------- | ----------------------- | --------------------------------------------------------- |
| Lenguaje          | PHP 8.2                 | Tipado estricto, enumerados nativos, propiedades readonly |
| Framework         | Laravel 12              | Eloquent ORM maduro, ecosistema, productividad            |
| Autenticación    | Laravel Sanctum 4       | Bearer tokens stateless, idóneo para SPA + PWA           |
| WebSockets        | Laravel Reverb 1.10     | Servidor WebSocket nativo, protocolo Pusher               |
| Base de datos     | MySQL 8 / MariaDB 10.4+ | Estándar industrial, soporte JSON, transacciones         |
| Testing           | PHPUnit 11              | Cobertura unitaria y de funcionalidad                     |
| Estilo de código | Laravel Pint            | Cumplimiento PSR-12 automatizado                          |

### Frontend

| Capa              | Tecnología                 | Justificación                                          |
| ----------------- | --------------------------- | ------------------------------------------------------- |
| Librería UI      | React 19                    | Hooks, características concurrentes, ecosistema        |
| Lenguaje          | TypeScript 5                | Tipado estático, refactors seguros                     |
| Bundler           | Vite 7                      | Hot Module Replacement instantáneo, builds optimizados |
| Routing           | React Router 7              | Estándar SPA, lazy routes                              |
| Cliente HTTP      | Axios 1.13                  | Interceptores para autenticación y manejo de errores   |
| WebSocket cliente | Laravel Echo + pusher-js    | Cliente oficial para Reverb                             |
| Gráficos         | Recharts 3                  | Componentes SVG declarativos                            |
| QR                | html5-qrcode + qrcode.react | Lectura mediante cámara y generación                  |
| Notificaciones    | Sileo + Sonner              | Toasts in-app                                           |
| Generación PDF   | jsPDF + autotable           | Exportación de partes de trabajo                       |
| Diagrama Gantt    | frappe-gantt                | Vista cronológica de órdenes                          |

### Infraestructura

| Servicio             | Plataforma                    | Coste                                     |
| -------------------- | ----------------------------- | ----------------------------------------- |
| Frontend estático   | Vercel (Hobby)                | Gratuito                                  |
| Backend API + Reverb | Render (Web Service Docker)   | Gratuito (sleep tras 15 min sin tráfico) |
| Base de datos        | Clever Cloud MySQL (plan DEV) | Gratuito (10 MB)                          |
| Repositorio          | GitHub                        | Gratuito                                  |

---

## Estructura del repositorio

```
OrdenYa/
├── backend/                      API REST Laravel 12  — ver backend/README.md
│   ├── app/
│   │   ├── Http/Controllers/     AuthController, WorkOrderController, etc.
│   │   ├── Models/               Eloquent: User, WorkOrder, WorkSession, ...
│   │   ├── Events/               Broadcasting de cambios
│   │   └── Http/Middleware/      EnsureRole
│   ├── database/
│   │   ├── migrations/           Esquema completo (14 migraciones)
│   │   └── seeders/              Datos demo (6 usuarios, 15 órdenes, ~90 sesiones)
│   ├── routes/api.php            Endpoints REST
│   ├── config/                   broadcasting, sanctum, cors, queue, ...
│   ├── tests/                    Feature + Unit
│   └── Dockerfile                Despliegue en Render
│
├── frontend/                     SPA React 19  — ver frontend/README.md
│   ├── public/
│   │   ├── manifest.webmanifest  Configuración PWA
│   │   ├── sw.js                 Service Worker
│   │   └── logo_ordenya_pro.svg
│   ├── src/
│   │   ├── pages/                adminView/, supervisorView/, trabajadorView/, shared/
│   │   ├── components/           Sidebar, FloatingTimer, QRScanner, ...
│   │   ├── services/             Capa axios (un archivo por recurso)
│   │   ├── context/              AuthContext, ThemeContext, MobileNavContext
│   │   ├── hooks/                useWorkOrdersChannel, ...
│   │   ├── routing/              PrivateRoute, RoleRoute
│   │   └── utils/                errorHelper, dateHelper, ...
│   └── vite.config.js
│
├── README.md                     Este archivo
├── Deploy.md                     Guía completa de despliegue cloud
├── iniciar_proyecto.bat          Script Windows: arranca backend + reverb + frontend
└── stop.bat                      Script Windows: detiene los procesos
```

---

## Requisitos previos

| Herramienta     | Versión mínima   | Notas                                                                                                                   |
| --------------- | ------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| PHP             | 8.2                | Extensiones:`pdo_mysql`, `mbstring`, `openssl`, `tokenizer`, `xml`, `ctype`, `json`, `gd`, `fileinfo` |
| Composer        | 2.x                | https://getcomposer.org/download/                                                                                       |
| Node.js         | 18 LTS o superior  | https://nodejs.org (incluye npm)                                                                                        |
| MySQL / MariaDB | 8.0 / 10.4+        | Recomendado:**XAMPP** — https://www.apachefriends.org                                                            |
| Git             | Cualquier versión | Para clonar el repositorio                                                                                              |

Comprobación rápida:

```bash
php -v && composer -V && node -v && npm -v && mysql --version
```

---

## Instalación local

### 1. Obtener el código

```bash
git clone https://github.com/Franfuu/OrdenYa.git
cd OrdenYa
```

### 2. Arrancar MySQL y crear la base de datos

Desde XAMPP Control Panel: **Start** en MySQL → **Admin** (abre phpMyAdmin) → crear base de datos `ordenes_trabajo` con cotejamiento `utf8mb4_unicode_ci`.

Alternativa por consola:

```sql
CREATE DATABASE ordenes_trabajo CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

### 3. Backend

```bash
cd backend
composer install
copy .env.example .env       # Linux/Mac: cp .env.example .env
php artisan key:generate
php artisan migrate:fresh --seed
php artisan storage:link
php artisan serve --host=127.0.0.1 --port=8000
```

Edita `backend/.env` con las credenciales de tu base de datos si difieren de las predeterminadas:

```env
DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=ordenes_trabajo
DB_USERNAME=root
DB_PASSWORD=
```

La API queda disponible en **http://localhost:8000**. Mantén la terminal abierta.

### 4. WebSockets (opcional, recomendado)

En otra terminal:

```bash
cd backend
php artisan reverb:start
```

Servidor WebSocket en **localhost:8080**.

### 5. Frontend

En otra terminal:

```bash
cd frontend
npm install
```

Crea el archivo `frontend/.env`:

```env
VITE_API_URL=http://localhost:8000/api
VITE_REVERB_APP_KEY=local-key
VITE_REVERB_HOST=localhost
VITE_REVERB_PORT=8080
VITE_REVERB_SCHEME=http
```

Arrancar:

```bash
npm run dev
```

Aplicación disponible en **http://localhost:5173**.

> **Atajo para Windows:** el script `start.bat` en la raíz lanza las tres terminales automáticamente.

---

## Credenciales de demostración

Contraseña común: `admin123`

| Rol                       | Email                     |
| ------------------------- | ------------------------- |
| Administrador             | `admin@admin.com`       |
| Supervisor (Taller)       | `carlos@supervisor.com` |
| Supervisor (Instalación) | `ana@supervisor.com`    |
| Trabajador                | `maria@trabajador.com`  |
| Trabajador                | `luis@trabajador.com`   |
| Trabajador                | `marcos@trabajador.com` |

---

## Flujo de uso por rol

### Administrador

1. Panel de control: KPIs (órdenes activas, finalizadas, horas trabajadas), gráfico de tendencia mensual, donut por departamento y listado de órdenes próximas a vencer.
2. **Crear orden**: código autogenerado `V26-NNNN`, selección de pieza del catálogo, asignación de departamentos y trabajadores. Las unidades se reparten automáticamente entre los trabajadores asignados.
3. **Gestión de usuarios**: CRUD completo con guardas anti-self-delete y anti-último-administrador.
4. **Catálogo de piezas** con foto.
5. **Detalle de orden**: badge de prioridad, código QR escaneable, historial de auditoría y lista de sesiones.

### Supervisor

- Lectura de todas las órdenes y creación restringida a su departamento (Taller o Instalación).
- CRUD completo del catálogo de piezas.
- Recibe **notificaciones en vivo** cuando un trabajador de su departamento completa su cuota; puede aprobarla con un click — el trabajador deja de ver la orden al instante.
- No puede editar ni eliminar órdenes existentes, ni gestionar usuarios.

### Trabajador

1. Solo ve las órdenes en las que está asignado (filtrado en el backend).
2. **Play / Pausa / Stop** por fase. El input de piezas aparece únicamente en la fase final (Pintar en Taller, Instalación en el departamento Instalación).
3. **Acceso rápido** a tareas comunes: Limpieza, Mantenimiento, Búsqueda y **escaneo QR** mediante cámara.
4. **Entrada manual** de sesiones pasadas (rango máximo: últimos 30 días, sin fechas futuras).
5. **Cronómetro flotante** persistente entre páginas mientras hay una sesión activa.
6. **Mi Diario** con resumen del día.
7. Notificaciones in-app cuando se le asigna una nueva orden.

---

## Comunicación en tiempo real

La aplicación actualiza vistas y notificaciones al instante, sin recargar y sin polling agresivo.

- **Notificaciones push** instantáneas al supervisor cuando un trabajador completa su cuota. Al aprobarla, la orden desaparece de la lista del trabajador en tiempo real.
- **Lista de órdenes viva**: las operaciones de crear, editar, duplicar, eliminar, finalizar departamento o terminar una sesión emiten un evento broadcast.
- **Canales privados** autenticados con Sanctum (`/api/broadcasting/auth`). El canal público `work-orders` se utiliza para señales de cambio.
- **Fail-safe**: si el WebSocket cae, el polling de respaldo (cada 60 s) mantiene los datos al día.

Variables relevantes (ya configuradas tras `php artisan reverb:install`):

```env
# backend/.env
BROADCAST_CONNECTION=reverb
REVERB_APP_KEY=...
REVERB_HOST=localhost
REVERB_PORT=8080
REVERB_SCHEME=http

# frontend/.env
VITE_REVERB_APP_KEY=...
VITE_REVERB_HOST=localhost
VITE_REVERB_PORT=8080
VITE_REVERB_SCHEME=http
```

---

## Aplicación instalable (PWA)

Con el frontend corriendo, abre la URL desde el navegador del dispositivo (en la misma red Wi-Fi):

- **Android (Chrome / Edge):** botón ámbar **"Instalar app"** arriba a la derecha, o menú → "Instalar app".
- **iOS / iPad (Safari):** botón compartir → "Añadir a pantalla de inicio".
- **Escritorio (Chrome / Edge):** icono de instalación en la barra de direcciones.

La aplicación se abre a pantalla completa, sin barra del navegador, con su propio icono en el home.

> Para conectarse desde otro dispositivo de la red local, sustituye `localhost` por la IP del PC (por ejemplo `192.168.1.42`) tanto en la URL del navegador como en `VITE_API_URL`.

---

## Despliegue en la nube

Stack productivo gratuito documentado paso a paso en [`Deploy.md`](./Deploy.md):

- **Frontend** → Vercel (build automático desde GitHub).
- **Backend** → Render (Docker, auto-deploy desde la rama `main`).
- **MySQL** → Clever Cloud (addon `mysql-addon`, plan DEV).

URLs de producción:

- Frontend: https://orden-ya.vercel.app
- API: https://ordenya-backend.onrender.com

---

## Seguridad

- Autenticación Sanctum mediante Bearer tokens.
- Middleware `role:admin,supervisor,trabajador` por endpoint.
- Un trabajador no puede iniciar sesión en órdenes ajenas (validado en backend).
- Cuota de piezas validada: no pueden registrarse más unidades que las asignadas.
- Sesiones concurrentes en la misma orden bloqueadas.
- `manualSession` con rango de fechas validado (últimos 30 días, sin fechas futuras).
- Un administrador no puede auto-eliminarse ni eliminar al último administrador.
- Las piezas referenciadas por órdenes no pueden borrarse.
- Sanitización `strip_tags` en notas de sesiones.
- Mensajes de validación en español (`lang/es/validation.php`).
- Supervisor restringido a operar en su departamento global.
- Canales WebSocket privados autenticados con Sanctum.
- Throttling en `/auth/login` (10 intentos por minuto).
- CORS configurado por dominio en producción.

---

## Comandos útiles

### Backend

```bash
php artisan migrate:fresh --seed     # Recrear la base de datos desde cero con datos demo
php artisan migrate                  # Aplicar migraciones nuevas
php artisan db:seed                  # Rellenar datos demo
php artisan route:list               # Listar todas las rutas API
php artisan reverb:start             # Arrancar servidor WebSocket
php artisan config:clear             # Limpiar caché de configuración
./vendor/bin/pint                    # Formatear código PHP (PSR-12)
php artisan test                     # Ejecutar suite PHPUnit
```

### Frontend

```bash
npm run dev          # Servidor de desarrollo con Hot Module Replacement
npm run build        # Build de producción en /dist
npm run preview      # Previsualizar el build
npm run lint         # ESLint
```

---

## Resolución de problemas

| Síntoma                             | Causa probable                               | Solución                                                                              |
| ------------------------------------ | -------------------------------------------- | -------------------------------------------------------------------------------------- |
| `vendor/autoload.php not found`    | Composer no ejecutado                        | `composer install` en `backend/`                                                   |
| `could not connect to MySQL`       | MySQL parado o credenciales mal configuradas | Arrancar XAMPP; revisar `DB_*` en `.env`                                           |
| `Class App\Models\X not found`     | Autoload desactualizado                      | `composer dump-autoload`                                                             |
| Frontend `Network Error` o CORS    | API caída o `VITE_API_URL` mal            | Verificar `.env` + backend arrancado                                                 |
| Página en blanco al recargar        | Cache del navegador                          | Ctrl+Shift+R; reiniciar `npm run dev`                                                |
| Notificaciones o campana no se abren | Service Worker cacheado                      | DevTools → Application → Service Workers → Unregister                               |
| QR scanner no abre la cámara        | Requiere HTTPS o `localhost`               | Usar `localhost` o flag `chrome://flags/#unsafely-treat-insecure-origin-as-secure` |
| WebSocket no conecta                 | Reverb no arrancado                          | `php artisan reverb:start` en otra terminal                                          |

---

## Lista de comprobación para la defensa

- [ ] MySQL arrancado en XAMPP
- [ ] `php artisan serve` corriendo (terminal 1)
- [ ] `php artisan reverb:start` corriendo (terminal 2)
- [ ] `npm run dev` corriendo (terminal 3)
- [ ] Login `admin@admin.com / admin123`
- [ ] Recorrido: Panel de Control → Lista de Órdenes → Detalle (mostrar QR y auditoría) → Crear Orden → Gestión de Usuarios
- [ ] Cambiar a `maria@trabajador.com`: fichaje, cronómetro flotante, escaneo QR, Mi Diario
- [ ] Cambiar a `carlos@supervisor.com`: notificación en vivo al completar un trabajador y aprobación
- [ ] Cambio de tema (oscuro/claro)
- [ ] Demostración de instalación PWA en móvil
- [ ] Versión desplegada en Vercel

---

## Licencia y autoría

**Proyecto académico** desarrollado como Trabajo de Fin de Grado. Código fuente publicado con fines educativos y de evaluación. Logos y marca comercial reservados.

**Autor:** Francisco Pérez Ruiz
**Centro:** IES Francisco De Los Ríos
**Curso:** 2º Desarrollo De Aplicaciones Web
**Tutor académico:** Javier Mejías Real
**Repositorio:** https://github.com/Franfuu/OrdenYa
