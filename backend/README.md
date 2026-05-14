# OrdenYa — Backend (API REST)

Subsistema servidor del Trabajo de Fin de Grado **OrdenYa**: API REST y servidor WebSocket para la gestión de órdenes de trabajo industriales.

Stack: Laravel 12 · PHP 8.2 · MySQL 8 · Sanctum · Reverb.

Para la visión global del proyecto, la instalación conjunta y la arquitectura, consultar el [`README.md`](../README.md) raíz.

---

## Contenido

1. [Stack](#stack)
2. [Requisitos](#requisitos)
3. [Instalación](#instalación)
4. [Variables de entorno](#variables-de-entorno)
5. [Estructura del directorio](#estructura-del-directorio)
6. [Modelo de dominio](#modelo-de-dominio)
7. [Endpoints de la API](#endpoints-de-la-api)
8. [Autenticación y autorización](#autenticación-y-autorización)
9. [WebSockets (Reverb)](#websockets-reverb)
10. [Datos de demostración](#datos-de-demostración)
11. [Pruebas](#pruebas)
12. [Convenciones de código](#convenciones-de-código)
13. [Despliegue](#despliegue)

---

## Stack

| Componente | Versión | Función |
|------------|---------|---------|
| PHP | 8.2 | Lenguaje |
| Laravel | 12.x | Framework |
| Laravel Sanctum | 4.x | Autenticación mediante Bearer Token |
| Laravel Reverb | 1.10 | Servidor WebSocket nativo |
| Pusher PHP Server | 7.x | Cliente broadcasting |
| MySQL / MariaDB | 8.0 / 10.4+ | Persistencia |
| PHPUnit | 11.x | Testing |
| Laravel Pint | 1.x | Formateo PSR-12 automatizado |

---

## Requisitos

- PHP 8.2 con las extensiones `pdo_mysql`, `mbstring`, `openssl`, `tokenizer`, `xml`, `ctype`, `json`, `gd`, `fileinfo`.
- Composer 2.x.
- MySQL 8 o MariaDB 10.4 o superior.

---

## Instalación

Desde el directorio `backend/`:

```bash
composer install
cp .env.example .env             # Windows: copy .env.example .env
php artisan key:generate
php artisan migrate:fresh --seed
php artisan storage:link
php artisan serve --host=127.0.0.1 --port=8000
```

En otra terminal, para activar los WebSockets:
```bash
php artisan reverb:start
```

API disponible en `http://localhost:8000/api`.

---

## Variables de entorno

Archivo `.env`. Variables críticas:

```env
APP_NAME=OrdenYa
APP_ENV=local                       # local | production
APP_KEY=base64:...                  # generado por php artisan key:generate
APP_DEBUG=true                      # false en producción
APP_URL=http://localhost:8000
APP_LOCALE=es

# Base de datos
DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=ordenes_trabajo
DB_USERNAME=root
DB_PASSWORD=

# Broadcasting Reverb
BROADCAST_CONNECTION=reverb
REVERB_APP_ID=...
REVERB_APP_KEY=...
REVERB_APP_SECRET=...
REVERB_HOST=localhost
REVERB_PORT=8080
REVERB_SCHEME=http

# Sanctum (SPA + Bearer)
SANCTUM_STATEFUL_DOMAINS=localhost:5173
FRONTEND_URL=http://localhost:5173
```

> Para producción: ver [`../Deploy.md`](../Deploy.md) (claves Reverb, host Clever Cloud, dominio Vercel).

---

## Estructura del directorio

```
backend/
├── app/
│   ├── Events/                     Eventos broadcast (WorkOrdersChanged, ...)
│   ├── Http/
│   │   ├── Controllers/
│   │   │   ├── AuthController.php
│   │   │   ├── UserController.php
│   │   │   ├── WorkOrderController.php      Órdenes + sesiones + finalización
│   │   │   ├── PiezaController.php
│   │   │   ├── NotificationController.php
│   │   │   └── AuditLogController.php
│   │   └── Middleware/
│   │       └── EnsureRole.php               role:admin,supervisor,trabajador
│   └── Models/
│       ├── User.php
│       ├── WorkOrder.php
│       ├── WorkSession.php
│       ├── Department.php
│       ├── Phase.php
│       ├── WorkOrderDepartment.php          Entidad débil
│       ├── WorkOrderPhase.php               Entidad débil
│       ├── WorkOrderDepartmentWorker.php    Entidad débil
│       ├── Pieza.php
│       ├── Notification.php
│       └── AuditLog.php
├── config/                         broadcasting, sanctum, cors, queue, ...
├── database/
│   ├── migrations/                 14 migraciones (esquema completo)
│   ├── seeders/                    DatabaseSeeder (datos demo)
│   └── factories/
├── lang/es/                        Mensajes de validación en español
├── public/                         index.php, storage symlink
├── routes/
│   ├── api.php                     Endpoints REST
│   ├── channels.php                Canales broadcasting
│   └── web.php
├── storage/app/public/             Imágenes subidas
├── tests/
├── Dockerfile                      Despliegue en Render
└── docker-start.sh                 Entrypoint: migrate + reverb + serve
```

---

## Modelo de dominio

Diez entidades principales en **3NF/BCNF** salvo dos compromisos deliberados (denormalización de `work_sessions.work_order_id` y referencia polimórfica en `audit_logs`).

```
   ┌──────┐       ┌────────────┐       ┌────────────┐
   │ User │───────│WorkSession │───────│ WorkOrder  │
   └───┬──┘       └────┬───────┘       └────┬───────┘
       │               │                    │
       │               │   ┌────────────────┤
       │               │   │                │
       │       ┌───────▼───▼─────┐   ┌─────▼──────┐
       │       │WorkOrderDept    │───│ Department │
       │       │(entidad débil)  │   └─────┬──────┘
       │       └─┬──────────────┬┘         │
       │         │              │          │
       │ ┌───────▼──────┐ ┌─────▼────────┐ │
       ├─│WODeptWorker  │ │WorkOrderPhase│─┴── Phase
       │ │piezas, approv│ │is_active     │
       │ └──────────────┘ └──────────────┘
       │
       ├── Notification (1:N)
       └── AuditLog (referencia polimórfica)
```

Diagramas formales (ER Chen + UML clases) en la memoria del TFG, capítulo 4.

### Entidades débiles

- **`WorkOrderDepartment`** — identificada por (`work_order_id`, `department_id`). Atributo propio: `finalizado_at`.
- **`WorkOrderPhase`** — identificada por (`work_order_department_id`, `phase_id`). Atributo: `is_active`.
- **`WorkOrderDepartmentWorker`** — identificada por (`work_order_department_id`, `user_id`). Atributos: `piezas_asignadas`, `approved_at`, `approved_by`.

### Reglas semánticas implementadas

- Unicidad: `(orden, departamento)`, `(ejec_depto, fase)`, `(ejec_depto, usuario)`.
- Cuota: la suma de `sesiones.piezas` no puede exceder `asignacion.piezas_asignadas` (validado en `WorkOrderController::recordPieces`).
- Cierre: una orden solo puede cerrarse cuando todas sus `WorkOrderDepartment` están finalizadas.
- Sanitización: `strip_tags` aplicado a `notas` de sesiones (`sanitizeNotas`).

---

## Endpoints de la API

Todos los endpoints están prefijados con `/api`. La cabecera de autenticación es `Authorization: Bearer {token}`, salvo en `/auth/login`.

### Autenticación

| Método | Ruta | Rol | Descripción |
|--------|------|-----|-------------|
| `POST` | `/auth/login` | público | Login. Devuelve `token` y `user`. Rate-limit de 10 intentos/minuto |
| `POST` | `/auth/logout` | autenticado | Revoca el token actual |
| `GET`  | `/auth/me` | autenticado | Datos del usuario autenticado |
| `GET`  | `/auth/profile` | autenticado | Perfil propio extendido |
| `PUT`  | `/auth/profile` | autenticado | Actualizar perfil propio |

### Usuarios

| Método | Ruta | Rol | Descripción |
|--------|------|-----|-------------|
| `GET`  | `/users` | admin · supervisor | Listar |
| `GET`  | `/users/{user}` | admin · supervisor | Detalle |
| `POST` | `/users` | admin | Crear |
| `PUT`  | `/users/{user}` | admin | Actualizar (anti-último-admin) |
| `DELETE` | `/users/{user}` | admin | Eliminar (anti-self-delete) |
| `GET`  | `/users/{user}/sessions` | autenticado | Sesiones del usuario |
| `GET`  | `/users/{user}/stats` | autenticado | KPIs personales |
| `GET`  | `/users/{user}/orders/{wo}/sessions` | autenticado | Sesiones por orden |

### Órdenes — lectura

| Método | Ruta | Rol | Descripción |
|--------|------|-----|-------------|
| `GET`  | `/work-orders` | todos | Listado filtrado por rol |
| `GET`  | `/work-orders/{wo}` | todos | Detalle con relaciones |

### Órdenes — escritura

| Método | Ruta | Rol | Descripción |
|--------|------|-----|-------------|
| `POST` | `/work-orders` | admin · supervisor | Crear |
| `PUT`  | `/work-orders/{wo}` | admin · supervisor | Actualizar |
| `DELETE` | `/work-orders/{wo}` | admin · supervisor | Eliminar |
| `POST` | `/work-orders/{wo}/duplicate` | admin · supervisor | Duplicar |
| `POST` | `/work-orders/bulk` | admin · supervisor | Acción en lote (eliminar / cambiar prioridad) |
| `POST` | `/work-orders/{wo}/upload-image` | admin · supervisor | Subir imagen |

### Sesiones de trabajo

| Método | Ruta | Rol | Descripción |
|--------|------|-----|-------------|
| `GET`  | `/sessions/active` | autenticado | Sesión activa del usuario |
| `POST` | `/work-orders/{wo}/start` | trabajador · supervisor | Iniciar cronómetro |
| `POST` | `/work-orders/{wo}/pause` | trabajador · supervisor | Pausar (cierra sesión) |
| `POST` | `/work-orders/{wo}/stop` | trabajador · supervisor | Detener y registrar piezas |
| `POST` | `/work-orders/{wo}/manual-session` | trabajador · supervisor | Sesión retroactiva (≤ 30 días) |
| `POST` | `/work-orders/generic-start` | trabajador · supervisor | Inicio genérico (Limpieza, Mantenimiento...) |
| `PUT`  | `/work-sessions/{session}` | trabajador · supervisor | Editar sesión |

### Gestión dinámica de órdenes

| Método | Ruta | Rol | Descripción |
|--------|------|-----|-------------|
| `POST` | `/work-orders/{wo}/add-department` | admin · supervisor | Añadir departamento |
| `POST` | `/work-orders/{wo}/add-workers` | admin · supervisor | Añadir trabajadores |
| `POST` | `/work-orders/{wo}/remove-worker` | admin · supervisor | Quitar trabajador |
| `POST` | `/work-orders/{wo}/assign-pieces` | admin · supervisor | Reasignar cuota global |
| `DELETE` | `/work-orders/{wo}/departments/{dept}` | admin · supervisor | Eliminar departamento |
| `PUT`  | `/work-orders/{wo}/departments/{dept}/phases` | admin · supervisor | Activar / desactivar fases |
| `PUT`  | `/work-orders/{wo}/departments/{dept}/workers/{w}/piezas` | admin · supervisor | Cuota individual |

### Cierre y aprobación

| Método | Ruta | Rol | Descripción |
|--------|------|-----|-------------|
| `POST` | `/work-orders/{wo}/finalize-department` | admin · supervisor | Cerrar departamento |
| `POST` | `/work-orders/{wo}/finalize` | admin · supervisor | Cerrar orden |
| `POST` | `/work-orders/{wo}/reopen` | admin · supervisor | Reabrir orden |
| `POST` | `/work-orders/{wo}/departments/{dept}/workers/{w}/approve` | admin · supervisor | Aprobar trabajo |

### Catálogo de piezas

| Método | Ruta | Rol | Descripción |
|--------|------|-----|-------------|
| `GET`  | `/piezas` | todos | Listar |
| `GET`  | `/piezas/{pieza}` | todos | Detalle |
| `POST` | `/piezas` | admin · supervisor | Crear |
| `PUT`  | `/piezas/{pieza}` | admin · supervisor | Actualizar |
| `DELETE` | `/piezas/{pieza}` | admin · supervisor | Eliminar (rechazada si está en uso) |

### Auditoría y notificaciones

| Método | Ruta | Rol | Descripción |
|--------|------|-----|-------------|
| `GET`  | `/work-orders/{wo}/audit` | autenticado | Historial de cambios |
| `GET`  | `/notifications` | autenticado | Bandeja propia |
| `POST` | `/notifications/mark-all-read` | autenticado | Marcar todas como leídas |
| `POST` | `/notifications/{n}/approve` | autenticado | Aprobar (flujo supervisor) |

### Broadcasting

| Método | Ruta | Descripción |
|--------|------|-------------|
| `POST` | `/broadcasting/auth` | Handshake autenticado para canales privados (Sanctum) |

Listado completo en tiempo de ejecución:
```bash
php artisan route:list
```

---

## Autenticación y autorización

### Tokens Sanctum

Petición:
```http
POST /api/auth/login
Content-Type: application/json

{ "email": "admin@admin.com", "password": "admin123" }
```

Respuesta:
```json
{
  "user": { "id": 1, "name": "Admin", "email": "admin@admin.com", "role": "admin" },
  "token": "1|abcdefgh..."
}
```

Uso posterior:
```http
GET /api/work-orders
Authorization: Bearer 1|abcdefgh...
```

### Middleware de roles

Cada grupo de rutas declara los roles permitidos:
```php
Route::middleware('role:admin,supervisor')->group(...)
```

El middleware `EnsureRole` (`app/Http/Middleware/EnsureRole.php`) verifica que `$user->role` se encuentre en la lista; en caso contrario, devuelve `403 Forbidden`.

### Lógica fina por rol

- **Trabajador**: solo ve las órdenes en las que está asignado (filtrado en `WorkOrderController::index`).
- **Supervisor**: solo puede crear órdenes en su departamento global (`User->departamento`), validado en `ensureSupervisorCanManage`.
- **Administrador**: acceso total, salvo auto-eliminación.

---

## WebSockets (Reverb)

### Eventos broadcast

- **`WorkOrdersChanged`** — canal público `work-orders`. Emitido en create/update/delete/duplicate/finalize/reopen y al detener sesiones. Payload: `{ action, work_order_id, meta }`.
- **`Notification`** (Laravel) — canal privado `App.Models.User.{id}`. Push al destinatario.

### Definición de canales (`routes/channels.php`)

```php
Broadcast::channel('App.Models.User.{id}', fn($user, $id) => (int) $user->id === (int) $id);
Broadcast::channel('work-orders', fn() => true);
```

### Cliente

El frontend utiliza Laravel Echo + pusher-js apuntando a Reverb. Ver [`../frontend/README.md`](../frontend/README.md).

### Producción

Reverb se ejecuta como segundo proceso dentro del mismo contenedor Render (`docker-start.sh`).

---

## Datos de demostración

El comando `php artisan migrate:fresh --seed` genera:

- **6 usuarios**: 1 administrador, 2 supervisores, 3 trabajadores. Contraseña común: `admin123`.
- **2 departamentos** con fases (Taller: Cortar / Soldar / Pintar; Instalación: Montar / Pruebas / Entrega).
- **8 piezas** con foto.
- **15 órdenes** con prioridades, fechas y códigos QR únicos.
- **Aproximadamente 90 sesiones** distribuidas en los últimos 30 días para alimentar los gráficos.
- Notificaciones y registros de auditoría.

---

## Pruebas

Ejecución de la suite:
```bash
php artisan test
```

Organización:
- `tests/Feature/` — pruebas de endpoints completos.
- `tests/Unit/` — pruebas unitarias de modelos y helpers.

Cobertura objetivo: autenticación, creación de órdenes, ciclo completo de sesiones (start/pause/stop) y reglas de cuota.

---

## Convenciones de código

- **PSR-12** automatizado mediante Laravel Pint:
  ```bash
  ./vendor/bin/pint
  ```
- Modelos Eloquent en singular PascalCase, tablas en plural snake_case, controladores con sufijo `Controller`.
- Validación con `Validator::make`; reglas custom en `app/Rules` cuando se reutilizan.
- Respuestas siempre tipadas como `JsonResponse`.

---

## Despliegue

Pasos completos en [`../Deploy.md`](../Deploy.md). Resumen:

1. **Base de datos**: Clever Cloud MySQL (addon `mysql`, plan DEV gratuito, 10 MB).
2. **API y Reverb**: Render Web Service con Docker (`Dockerfile` incluido).
   - Build automático desde la rama `main`.
   - Variables en panel Render: `APP_KEY`, `DB_*`, `REVERB_*`, `FRONTEND_URL`.
   - Entrypoint `docker-start.sh` ejecuta `migrate --force`, `reverb:start` y `php-fpm`.
3. **Migraciones**: aplicadas automáticamente en cada despliegue.

URL pública de la API: https://ordenya-backend.onrender.com

---

## Licencia

Proyecto académico — Trabajo de Fin de Grado. Ver [`README.md`](../README.md) raíz.
