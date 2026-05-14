# OrdenYa — Frontend (SPA)

Subsistema cliente del Trabajado de Fin de Grado **OrdenYa**: Single Page Application instalable como Progressive Web App.

Stack: React 19 · TypeScript 5 · Vite 7 · React Router 7 · Axios · Laravel Echo.

Para la visión global del proyecto, la instalación conjunta y la arquitectura, consultar el [`README.md`](../README.md) raíz.

---

## Contenido

1. [Stack](#stack)
2. [Requisitos](#requisitos)
3. [Instalación](#instalación)
4. [Variables de entorno](#variables-de-entorno)
5. [Estructura del directorio](#estructura-del-directorio)
6. [Routing y control de acceso](#routing-y-control-de-acceso)
7. [Gestión de estado](#gestión-de-estado)
8. [Capa de servicios HTTP](#capa-de-servicios-http)
9. [Comunicación en tiempo real](#comunicación-en-tiempo-real)
10. [Progressive Web App](#progressive-web-app)
11. [Componentes destacados](#componentes-destacados)
12. [Sistema de temas](#sistema-de-temas)
13. [Convenciones de código](#convenciones-de-código)
14. [Scripts disponibles](#scripts-disponibles)
15. [Despliegue](#despliegue)

---

## Stack

| Componente | Versión | Función |
|------------|---------|---------|
| React | 19 | Librería UI |
| TypeScript | 5 | Tipado estático |
| Vite | 7 | Bundler y servidor de desarrollo |
| React Router | 7 | Routing SPA con lazy loading |
| Axios | 1.13 | Cliente HTTP con interceptores |
| Laravel Echo + pusher-js | 2.3 + 8.5 | Cliente WebSocket para Reverb |
| Recharts | 3 | Gráficos SVG declarativos |
| html5-qrcode | 2.3 | Lectura de QR mediante cámara |
| qrcode.react | 4.2 | Generación de QR en SVG |
| jsPDF + autotable | 4 + 5 | Exportación a PDF de partes |
| frappe-gantt | 1.2 | Diagrama de Gantt |
| Sileo + Sonner | — | Notificaciones in-app |
| ESLint | 9 | Linting |

---

## Requisitos

- Node.js 18 LTS o superior.
- npm 9 o superior (incluido con Node.js).
- Backend OrdenYa corriendo en `http://localhost:8000` (ver [`../backend/README.md`](../backend/README.md)).

---

## Instalación

Desde el directorio `frontend/`:

```bash
npm install
```

Crear el archivo `.env` con las variables mínimas:
```env
VITE_API_URL=http://localhost:8000/api
VITE_REVERB_APP_KEY=local-key
VITE_REVERB_HOST=localhost
VITE_REVERB_PORT=8080
VITE_REVERB_SCHEME=http
```

Arrancar el servidor de desarrollo:
```bash
npm run dev
```

Aplicación disponible en `http://localhost:5173`.

---

## Variables de entorno

Las variables expuestas al cliente deben comenzar con el prefijo `VITE_` para ser inyectadas en tiempo de build.

| Variable | Descripción | Ejemplo local | Ejemplo producción |
|----------|-------------|---------------|--------------------|
| `VITE_API_URL` | URL base de la API REST | `http://localhost:8000/api` | `https://ordenya-backend.onrender.com/api` |
| `VITE_REVERB_APP_KEY` | Clave pública del servidor Reverb | `local-key` | (la del backend en producción) |
| `VITE_REVERB_HOST` | Host del servidor WebSocket | `localhost` | `ordenya-backend.onrender.com` |
| `VITE_REVERB_PORT` | Puerto WebSocket | `8080` | `443` |
| `VITE_REVERB_SCHEME` | Esquema del WebSocket | `http` | `https` |

> En Vercel, las variables se configuran en **Project Settings → Environment Variables**. Tras añadirlas, se requiere un nuevo deploy para que se apliquen.

---

## Estructura del directorio

```
frontend/
├── public/
│   ├── manifest.webmanifest        Manifiesto PWA (icono, colores, modo standalone)
│   ├── sw.js                       Service Worker (cache first para assets)
│   ├── logo_ordenya_pro.svg        Logo oficial
│   └── icons/                      Iconos PWA en varios tamaños
├── src/
│   ├── auth/
│   │   └── AuthContext.tsx         Provider de autenticación (token + user)
│   ├── components/
│   │   ├── layout/
│   │   │   ├── Sidebar.tsx
│   │   │   └── Topbar.tsx
│   │   ├── ConfirmDialog.tsx
│   │   ├── FloatingTimer.tsx       Cronómetro persistente entre páginas
│   │   ├── InstallPWAButton.tsx
│   │   ├── NotificationBell.tsx
│   │   ├── QRScanner.tsx           Lector de QR con html5-qrcode
│   │   └── Icons.tsx
│   ├── constants/                  Constantes del dominio
│   ├── context/
│   │   ├── ThemeContext.tsx        Modo oscuro/claro persistido en localStorage
│   │   └── MobileNavContext.tsx    Estado del drawer móvil
│   ├── hooks/
│   │   └── useWorkOrdersChannel.ts Suscripción al canal Reverb 'work-orders'
│   ├── pages/
│   │   ├── LandingPage.tsx         Ruta /
│   │   ├── Login.tsx               Ruta /login
│   │   ├── NotFound.tsx            Ruta 404
│   │   ├── adminView/              Pantallas del rol administrador
│   │   ├── supervisorView/         Pantallas del rol supervisor
│   │   ├── trabajadorView/         Pantallas del rol trabajador
│   │   └── shared/                 Componentes reutilizables entre vistas
│   ├── routing/
│   │   ├── PrivateRoute.tsx        Bloquea acceso si no hay sesión
│   │   └── RoleRoute.tsx           Bloquea acceso según rol
│   ├── services/                   Capa axios (un archivo por recurso)
│   │   ├── api.ts                  Instancia axios con interceptores
│   │   ├── authService.ts
│   │   ├── workOrderService.ts
│   │   ├── userService.ts
│   │   ├── piezaService.ts
│   │   └── notificationService.ts
│   ├── styles/                     Hojas CSS específicas
│   ├── types/                      Definiciones TypeScript del dominio
│   ├── utils/
│   │   ├── errorHelper.ts          Normalización de errores y toasts
│   │   └── dateHelper.ts
│   ├── App.tsx                     Composición de Routes y Providers
│   ├── App.css
│   ├── index.css                   Estilos globales (variables CSS, tema)
│   └── main.tsx                    Entry point
├── eslint.config.js
├── tsconfig.json
├── vite.config.js
├── vercel.json                     Configuración de deploy en Vercel
└── package.json
```

---

## Routing y control de acceso

El árbol de rutas se define en `App.tsx`:

```
/                         LandingPage           público
/login                    Login                 público
/admin/*                  AdminView             PrivateRoute + RoleRoute(admin)
/supervisor/*             SupervisorView        PrivateRoute + RoleRoute(supervisor)
/trabajador/*             TrabajadorView        PrivateRoute + RoleRoute(trabajador)
*                         NotFound              público
```

- **`PrivateRoute`** redirige a `/login` si no existe token válido en `localStorage`.
- **`RoleRoute`** redirige al panel correspondiente si el rol del usuario no coincide con el requerido.

Tras un login exitoso, el usuario es redirigido al panel propio de su rol.

---

## Gestión de estado

Se ha optado por **React Context** en lugar de Redux/Zustand por la escala del proyecto.

| Contexto | Responsabilidad | Persistencia |
|----------|-----------------|--------------|
| `AuthContext` | Token Bearer + datos del usuario autenticado + helpers `login()` / `logout()` | `localStorage` |
| `ThemeContext` | Modo oscuro/claro + helper `toggleTheme()` | `localStorage` |
| `MobileNavContext` | Estado abierto/cerrado del drawer en móviles | En memoria |

El estado local de cada pantalla se maneja con `useState` y `useEffect`.

---

## Capa de servicios HTTP

Toda comunicación con el backend pasa por `src/services/api.ts`, una instancia de axios configurada con:

- **Base URL** derivada de `VITE_API_URL`.
- **Interceptor de petición** que inyecta el header `Authorization: Bearer {token}` cuando hay sesión activa.
- **Interceptor de respuesta** que detecta `401` y dispara logout automático.

Cada recurso del backend tiene su propio service (por ejemplo `workOrderService.ts`):

```ts
export async function getWorkOrders(filters?: WorkOrderFilters): Promise<WorkOrder[]> {
  const { data } = await api.get('/work-orders', { params: filters });
  return data;
}
```

Los errores se normalizan mediante `utils/errorHelper.ts`, que extrae el mensaje legible de la respuesta de Laravel y lo muestra como toast (`sileo.error`).

---

## Comunicación en tiempo real

El hook `useWorkOrdersChannel` (`src/hooks/`) encapsula la suscripción al canal público `work-orders` de Reverb:

```ts
useWorkOrdersChannel((event) => {
  if (event.action === 'created') refetchList();
  if (event.action === 'finalized') showToast(...);
});
```

Internamente utiliza `laravel-echo` con `broadcaster: 'reverb'` y la configuración leída de las variables `VITE_REVERB_*`. La conexión se establece una sola vez al montar el provider y se reutiliza durante toda la sesión.

Las notificaciones individuales llegan por el canal privado `App.Models.User.{id}`, autenticado mediante el endpoint `/api/broadcasting/auth` (Sanctum).

**Estrategia fail-safe:** si Reverb está caído, un polling de respaldo cada 60 s mantiene los datos actualizados.

---

## Progressive Web App

La aplicación es instalable en móvil, tablet y escritorio gracias a:

- **`public/manifest.webmanifest`** — define nombre, iconos, colores de marca y `display: standalone`.
- **`public/sw.js`** — service worker básico con estrategia cache-first para assets estáticos.
- **`InstallPWAButton`** — captura el evento `beforeinstallprompt` y muestra un botón visible cuando la instalación es posible.

Instalación:
- Android (Chrome / Edge): botón "Instalar app" o menú del navegador.
- iOS / iPad (Safari): botón compartir → "Añadir a pantalla de inicio".
- Escritorio (Chrome / Edge): icono de instalación en la barra de direcciones.

> El scanner QR requiere contexto seguro (HTTPS o `localhost`). En LAN con IP local debe habilitarse el flag `chrome://flags/#unsafely-treat-insecure-origin-as-secure`.

---

## Componentes destacados

### `FloatingTimer`
Cronómetro persistente posicionado fijo abajo a la derecha. Se mantiene visible mientras el usuario navega entre páginas, mostrando el tiempo transcurrido de la sesión activa. Botones de pausa y stop integrados.

### `QRScanner`
Modal con acceso a la cámara del dispositivo mediante `html5-qrcode`. Permite al trabajador fichar simplemente apuntando al código QR de la orden. Gestiona los permisos del navegador y muestra mensajes claros si falla.

### `NotificationBell`
Campana de la barra superior con contador de notificaciones no leídas. Se actualiza en tiempo real vía Reverb. Al pulsar, despliega la bandeja con acciones contextuales (aprobar, marcar como leída).

### `Sidebar` y `Topbar`
Layout responsive: en escritorio se muestra un sidebar fijo a la izquierda; en móvil se transforma en drawer accesible desde un botón hamburguesa.

### `ConfirmDialog`
Diálogo de confirmación genérico, reutilizable para todas las acciones destructivas (eliminar orden, finalizar, etc.).

---

## Sistema de temas

Dos temas disponibles: **claro** y **oscuro**. El estado se gestiona desde `ThemeContext` y se persiste en `localStorage`.

Las variables CSS se definen en `index.css`:

```css
:root {
  --bg: #ffffff;
  --surface: #f3f4f6;
  --text-primary: #111827;
  --primary: #2563eb;
  --border-color: #e5e7eb;
}

[data-theme="dark"] {
  --bg: #0f172a;
  --surface: #1e293b;
  --text-primary: #f1f5f9;
  --primary: #3b82f6;
  --border-color: #334155;
}
```

Los componentes consumen estas variables, no colores fijos, garantizando coherencia visual entre temas.

---

## Convenciones de código

- **TypeScript estricto** habilitado (`strict: true` en `tsconfig.json`).
- **ESLint** con presets `@eslint/js`, `react-hooks` y `react-refresh`.
- **Componentes funcionales** con hooks: no se utiliza `class`.
- **Nombres**: componentes en PascalCase; hooks con prefijo `use`; servicios con sufijo `Service`.
- **Imports absolutos** desde `src/` (configurado en `tsconfig.json`).
- **Estilos**: CSS Modules o CSS global con variables; no se utiliza ningún framework CSS pesado (Tailwind, Bootstrap).

Comprobación:
```bash
npm run lint
```

---

## Scripts disponibles

| Comando | Descripción |
|---------|-------------|
| `npm run dev` | Servidor de desarrollo con Hot Module Replacement en `http://localhost:5173` |
| `npm run build` | Build de producción en `dist/` (TypeScript check + Vite bundle) |
| `npm run preview` | Servidor local para previsualizar el build de producción |
| `npm run lint` | ESLint sobre todo el código |

---

## Despliegue

Configurado en **Vercel** mediante `vercel.json`:

- Build command: `npm run build`
- Output directory: `dist`
- Rewrites: todas las rutas no-asset se reescriben a `/index.html` para que el routing SPA funcione tras un refresh.

Pasos:
1. Conectar el repositorio GitHub a Vercel (Project Settings → Git Integration).
2. Configurar las variables de entorno `VITE_*` en el panel de Vercel.
3. Cada push a `main` dispara un nuevo deploy automático.

URL pública: https://orden-ya.vercel.app

Pasos completos en [`../Deploy.md`](../Deploy.md).

---

## Licencia

Proyecto académico — Trabajo de Fin de Grado. Ver [`README.md`](../README.md) raíz.
