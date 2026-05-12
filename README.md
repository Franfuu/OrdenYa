# OrdenYa — Gestión de Órdenes de Trabajo

> TFG · Laravel 12 (API) + React 19 + Vite (SPA) + MySQL.
> Tres roles: **Administrador** · **Supervisor** · **Trabajador**.

---

## 📋 Requisitos previos en el PC

| Herramienta | Versión mínima | Notas |
|---|---|---|
| **PHP** | 8.2 | Con extensiones `pdo_mysql`, `mbstring`, `openssl`, `tokenizer`, `xml`, `ctype`, `json`, `gd`, `fileinfo` |
| **Composer** | 2.x | https://getcomposer.org/download/ |
| **Node.js** | 18 LTS o superior | https://nodejs.org/ (incluye npm) |
| **MySQL / MariaDB** | 8.0 / 10.4+ | Lo más cómodo: **XAMPP** (incluye Apache, MySQL y phpMyAdmin) — https://www.apachefriends.org/ |
| **Git** (opcional) | cualquier | Si copias el proyecto vía clone |

> 💡 Si ya tienes **XAMPP** instalado con `php` y `mysql` arrancando, no necesitas instalar nada más salvo Node.js y Composer.

### Comprobación rápida (PowerShell o CMD)

```bash
php -v
composer -V
node -v
npm -v
mysql --version
```

Todos deben devolver una versión, no "comando no reconocido".

---

## 🚀 Instalación paso a paso

### 1. Copiar el proyecto al PC

Si vas con USB:
```
C:\Users\TU_USUARIO\Desktop\OrdenYa\
├── backend\
└── frontend\
```

O con Git:
```bash
cd C:\Users\TU_USUARIO\Desktop
git clone <url-del-repo> OrdenYa
```

### 2. Arrancar MySQL (XAMPP)

1. Abre **XAMPP Control Panel**
2. Click en **Start** junto a **MySQL**
3. Click en **Admin** junto a MySQL → abre phpMyAdmin
4. Crea una base de datos llamada `ordenes_trabajo`:
   - **Nombre**: `ordenes_trabajo`
   - **Cotejamiento**: `utf8mb4_unicode_ci`

Alternativa por consola:
```bash
mysql -u root -p
> CREATE DATABASE ordenes_trabajo CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
> exit
```

### 3. Configurar el Backend (Laravel)

```bash
cd backend
composer install
```

Esto instalará todas las dependencias PHP (~150MB en `vendor/`).

#### Crear el archivo `.env`

Copia el ejemplo:
```bash
copy .env.example .env
```

Edita `backend\.env` y deja la sección de DB así:

```env
APP_NAME=OrdenYa
APP_ENV=local
APP_KEY=
APP_DEBUG=true
APP_URL=http://localhost:8000
APP_LOCALE=es

DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=ordenes_trabajo
DB_USERNAME=root
DB_PASSWORD=
```

> Si tu MySQL tiene contraseña para root, ponla en `DB_PASSWORD`.

#### Generar APP_KEY y migrar la base de datos

```bash
php artisan key:generate
php artisan migrate:fresh --seed
```

El último comando crea **todas las tablas** y **rellena los datos demo**:
- 6 usuarios (1 admin, 2 supervisores, 3 trabajadores)
- 8 piezas de catálogo
- 15 órdenes de trabajo
- ~90 sesiones distribuidas en los últimos 30 días
- Notificaciones, comentarios y registros de auditoría

#### Crear carpeta de almacenamiento público

```bash
php artisan storage:link
```

Esto genera el symlink `public/storage` → `storage/app/public` para servir fotos de piezas y órdenes.

#### Arrancar el servidor backend

```bash
php artisan serve --host=127.0.0.1 --port=8000
```

✅ La API queda escuchando en **http://localhost:8000**

Deja esta ventana abierta. Abre otra terminal para el siguiente paso.

---

### 4. Configurar el Frontend (React)

```bash
cd frontend
npm install
```

Esto instala las dependencias JS (~250MB en `node_modules/`). Tarda 1-3 minutos la primera vez.

#### Crear el archivo `.env` del frontend

Crea **`frontend\.env`** (sin nombre, sólo extensión) con este contenido:

```env
VITE_API_URL=http://localhost:8000/api
```

#### Arrancar el servidor de desarrollo

```bash
npm run dev
```

✅ La app queda en **http://localhost:5173**

---

## 🔑 Credenciales demo

Todas con contraseña `admin123`:

| Rol | Email |
|---|---|
| **Administrador** | `admin@admin.com` |
| **Supervisor** | `carlos@supervisor.com` |
| **Supervisor** | `ana@supervisor.com` |
| **Trabajador** | `maria@trabajador.com` |
| **Trabajador** | `luis@trabajador.com` |
| **Trabajador** | `marcos@trabajador.com` |

---

## 📱 Instalar como app (PWA) en móvil o tablet

Una vez que tengas el frontend corriendo, abre la URL desde el navegador del dispositivo en la misma red Wi-Fi:

- **Android (Chrome / Edge)**: pulsa el botón ámbar **"Instalar app"** que aparece arriba a la derecha, o usa el menú → "Instalar app".
- **iOS / iPad (Safari)**: botón compartir (↑) → "Añadir a pantalla de inicio".

La app se abrirá fullscreen, sin barra del navegador. El icono OrdenYa aparece en el home.

> Para acceder desde otro dispositivo en la misma red, reemplaza `localhost` por la IP local del PC (ej. `192.168.1.42:5173`) en el navegador del móvil. Y en `frontend/.env` pon `VITE_API_URL=http://192.168.1.42:8000/api`.

---

## 🛠️ Estructura del proyecto

```
OrdenYa/
├── backend/                Laravel 12 API · puerto 8000
│   ├── app/
│   │   ├── Http/Controllers/
│   │   │   ├── AuthController.php
│   │   │   ├── WorkOrderController.php   # órdenes + sesiones + bulk + duplicar
│   │   │   ├── UserController.php
│   │   │   ├── PiezaController.php       # catálogo de piezas
│   │   │   ├── CommentController.php
│   │   │   ├── NotificationController.php
│   │   │   └── AuditLogController.php
│   │   └── Models/
│   │       ├── User, WorkOrder, WorkSession
│   │       ├── Department, Phase
│   │       ├── WorkOrderDepartment, WorkOrderPhase, WorkOrderDepartmentWorker
│   │       ├── Pieza, Comment, Notification, AuditLog
│   ├── database/migrations/        # esquema completo
│   ├── database/seeders/           # DatabaseSeeder con datos demo
│   ├── lang/es/validation.php      # mensajes de validación en español
│   └── routes/api.php
│
└── frontend/               React 19 + Vite · puerto 5173
    ├── public/
    │   ├── logo_ordenya_pro.svg    # logo oficial
    │   ├── manifest.webmanifest    # PWA manifest
    │   └── sw.js                   # Service Worker
    ├── src/
    │   ├── components/
    │   │   ├── ConfirmDialog.tsx
    │   │   ├── NotificationBell.tsx
    │   │   ├── FloatingTimer.tsx
    │   │   ├── QRScanner.tsx, VoiceInput.tsx
    │   │   ├── InstallPWAButton.tsx
    │   │   └── layout/Sidebar, Topbar
    │   ├── context/                # Auth, Theme, MobileNav
    │   ├── pages/
    │   │   ├── LandingPage.tsx     # /
    │   │   ├── Login.tsx           # /login
    │   │   ├── adminView/          # 7 pantallas
    │   │   ├── supervisorView/
    │   │   ├── trabajadorView/
    │   │   └── shared/             # KPIPanel, PiezasList, OrderComments, etc.
    │   └── services/               # axios services
    └── vite.config.js
```

---

## 🎭 Flujo de trabajo demo

### Como **Administrador**
1. Login → llegas al **Panel de Control** con KPIs, gráfico de tendencia, donut de departamentos y lista de "Próximas a vencer".
2. **Crear Orden**: código autogenerado (V26-NNNN), seleccionas pieza del catálogo, asignas departamentos (Taller / Instalación) y trabajadores. Las unidades se reparten **automáticamente** entre los trabajadores asignados.
3. **Gestión de Usuarios**: CRUD completo. Protección anti-self-delete y anti-último-admin.
4. **Piezas**: catálogo con foto.
5. En el **detalle** de cada orden ves: badge prioridad, **código QR escaneable** (preview en modal), comentarios, historial de cambios (audit log) e historial de sesiones.

### Como **Supervisor**
- Ve KPIs y todas las órdenes (lectura) + puede **crear órdenes nuevas** restringidas a su departamento global (Taller / Instalación).
- CRUD completo de **piezas**.
- Recibe **notificaciones en vivo** cuando un trabajador de su departamento completa su cuota y puede aprobarla con un click — el trabajador deja de ver la orden al instante.
- No puede editar/eliminar órdenes existentes ni gestionar usuarios.

### Como **Trabajador**
1. Ve **sólo sus órdenes asignadas** (filtrado en backend).
2. **Play/Pausa/Stop** por fase. El input de piezas **sólo aparece en la fase final** ("Pintar" en Taller, "Instalación" en el dept Instalación).
3. **Acceso Rápido**: Limpieza, Búsqueda, Mantenimiento, **Escanear QR** (cámara) para fichar.
4. **Entrada Manual**: registra sesiones pasadas (limitado a últimos 30 días).
5. **Cronómetro flotante** abajo a la derecha mientras hay sesión activa, persiste entre páginas.
6. **Mi Diario** con resumen del día.
7. Notificaciones in-app cuando le asignan una nueva orden.

---

## ⚡ Tiempo real (WebSockets · Laravel Reverb)

La app actualiza vistas e infos **al instante**, sin recargar y sin polling agresivo:

- 🔔 **Notificaciones push**: cuando un trabajador completa su cuota se crea una notificación al supervisor y le aparece en la campana sin refrescar. El supervisor pulsa **Aprobar** → la orden desaparece de la lista del trabajador en tiempo real.
- 📋 **Lista de órdenes viva**: crear/editar/duplicar/eliminar una orden, finalizar departamento o terminar una sesión emite un evento; cualquier admin/supervisor/trabajador con la lista abierta la ve refrescada automáticamente.
- 🟢 **Stack**: [Laravel Reverb](https://reverb.laravel.com/) (servidor WebSocket nativo de Laravel 12) + [`laravel-echo`](https://laravel.com/docs/12.x/broadcasting#client-side-installation) + `pusher-js` en el frontend.
- 🔒 **Canales privados** autenticados con Sanctum (`/api/broadcasting/auth`) — solo el dueño ve su canal `App.Models.User.{id}`. Canal público `work-orders` para señales de cambio.
- 🪶 **Fail-safe**: si Reverb cae, el polling de fondo (cada 60 s) sigue manteniendo los datos al día. Cero pantallas rotas.

### Arrancar Reverb en local
```bash
cd backend
php artisan reverb:start         # WebSocket server en localhost:8080
```
Necesitas **3 terminales**: `php artisan serve` (API), `php artisan reverb:start` (WS), `npm run dev` (front).

Variables relevantes (ya rellenadas por `reverb:install`):
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

## 🔐 Seguridad implementada

- ✅ Sanctum Bearer tokens
- ✅ Middleware `role:...` por endpoint
- ✅ Trabajador no puede iniciar sesión en órdenes que no le pertenecen
- ✅ Validación de cuota: no se pueden registrar más piezas que las asignadas
- ✅ Sin sesiones concurrentes en la misma orden
- ✅ Manual-session con rango de fechas validado (últimos 30 días, no futuro)
- ✅ Admin no puede auto-eliminarse ni eliminar el último admin
- ✅ Piezas en uso por órdenes no se pueden eliminar
- ✅ Sanitización `strip_tags` en notas de sesiones
- ✅ Mensajes de error de validación en español
- ✅ Supervisor restringido a crear órdenes solo en su departamento global (validado en backend)
- ✅ Canales privados Reverb autenticados con Sanctum

---

## 📦 Comandos útiles

### Backend
```bash
php artisan migrate:fresh --seed   # recrear DB desde cero con datos demo
php artisan migrate                # aplicar migraciones nuevas
php artisan db:seed                # rellenar datos demo
php artisan route:list             # listar todas las rutas API
php artisan config:clear           # limpiar caché de config
./vendor/bin/pint                  # formatear código PHP
```

### Frontend
```bash
npm run dev      # servidor de desarrollo con hot reload
npm run build    # build de producción en /dist
npm run preview  # previsualizar el build
npm run lint     # eslint
```

---

## ❓ Problemas comunes

**"vendor/autoload.php not found"** → ejecuta `composer install` en `backend/`.

**"could not connect to MySQL"** → arranca MySQL en XAMPP. Verifica `DB_HOST`, `DB_USERNAME`, `DB_PASSWORD` en `backend/.env`.

**"Class App\Models\X not found"** → ejecuta `composer dump-autoload` en `backend/`.

**Frontend muestra "Network Error" / CORS** → verifica que `frontend/.env` tenga `VITE_API_URL=http://localhost:8000/api` y que el backend esté arrancado.

**Página en blanco al recargar** → reinicia `npm run dev`. Limpia caché del navegador con **Ctrl+Shift+R**.

**Notificaciones / campana no se abren** → el service worker puede estar cacheado. En DevTools → Application → Service Workers → Unregister, y recarga.

**El QR scanner no abre la cámara** → necesita HTTPS o `localhost`. En localhost funciona; en LAN con IP, requiere HTTPS o permitir cámara en `chrome://flags/#unsafely-treat-insecure-origin-as-secure`.

---

## 🎯 Para la defensa — checklist

- [ ] MySQL arrancado en XAMPP
- [ ] `php artisan serve` en una terminal (deja la ventana abierta)
- [ ] `php artisan reverb:start` en otra terminal (WebSockets — tiempo real)
- [ ] `npm run dev` en otra terminal
- [ ] Login `admin@admin.com` / `admin123`
- [ ] Recorrer: Panel de Control → Lista de Órdenes → Detalle (mostrar QR + comentarios + audit) → Crear Orden → Gestión de Usuarios
- [ ] Cambiar a `maria@trabajador.com` → enseñar fichaje + cronómetro flotante + escaneo QR (si hay móvil) + Mi Diario
- [ ] Cambiar a `carlos@supervisor.com` → mostrar vista de sólo lectura
- [ ] Toggle de tema oscuro/claro
- [ ] Botón "Instalar app" → enseñar funcionalidad PWA

¡Listo para la defensa! 🚀
"# OrdenYa" 
