# Despliegue: Railway (backend) + Vercel (frontend)

## Cambios ya aplicados al código

| Archivo | Cambio | Por qué |
|---|---|---|
| `backend/app/Http/Controllers/AuthController.php` | Cookie `secure` y `samesite` dinámicos según entorno | En producción cross-domain (Railway+Vercel) la cookie necesita `secure=true` + `samesite=none` |
| `backend/config/cors.php` | `allowed_origins` lee `FRONTEND_URL` del `.env` | No hardcodear URL de Vercel en código |
| `backend/Procfile` | Comando de arranque para Railway | Railway necesita saber cómo lanzar Laravel |
| `backend/nixpacks.toml` | Extensiones PHP + build + start | Railway usa nixpacks para compilar el proyecto |

---

## Requisitos previos

- Repo subido a GitHub con estos cambios
- Cuenta en [railway.app](https://railway.app)
- Cuenta en [vercel.com](https://vercel.com)

---

## PASO 1 — Subir repo a GitHub

```bash
git add .
git commit -m "prepare production deploy"
git push origin main
```

---

## PASO 2 — Backend en Railway

### 2.1 Crear proyecto

1. Railway → **New Project** → **Deploy from GitHub**
2. Selecciona el repo
3. **Root Directory**: `backend`

### 2.2 Añadir base de datos MySQL

1. En el proyecto → **Add Service** → **Database** → **MySQL**
2. Railway crea la BD y expone variables automáticamente

### 2.3 Variables de entorno del backend

En el servicio backend → **Variables**, añadir:

```env
APP_ENV=production
APP_DEBUG=false
APP_URL=https://TU-BACKEND.up.railway.app
APP_KEY=                          # ver paso 2.4

DB_CONNECTION=mysql
DB_HOST=${{MySQL.MYSQL_HOST}}     # referencia Railway automática
DB_PORT=${{MySQL.MYSQL_PORT}}
DB_DATABASE=${{MySQL.MYSQL_DATABASE}}
DB_USERNAME=${{MySQL.MYSQL_USER}}
DB_PASSWORD=${{MySQL.MYSQL_PASSWORD}}

SESSION_DRIVER=database
SESSION_LIFETIME=120
SESSION_SECURE_COOKIE=true
SESSION_SAME_SITE=none

FILESYSTEM_DISK=local
FRONTEND_URL=https://TU-FRONTEND.vercel.app   # actualizar tras paso 4
```

### 2.4 Generar APP_KEY

Ejecutar localmente:
```bash
cd backend
php artisan key:generate --show
```
Copiar el resultado (`base64:...`) como valor de `APP_KEY`.

### 2.5 Verificar deploy

Railway despliega automático al hacer push. Comprobar logs. URL pública: `https://TU-BACKEND.up.railway.app`

Probar: `https://TU-BACKEND.up.railway.app/up` → debe devolver 200.

---

## PASO 3 — Frontend en Vercel

1. Vercel → **New Project** → importa repo de GitHub
2. Configura:
   - **Root Directory**: `frontend`
   - **Framework Preset**: Vite
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
3. **Environment Variables**:

```env
VITE_API_URL=https://TU-BACKEND.up.railway.app/api
```

4. **Deploy** → Vercel da URL: `https://TU-FRONTEND.vercel.app`

---

## PASO 4 — Actualizar FRONTEND_URL en Railway

Vuelve a Railway → Variables del backend → actualiza:
```env
FRONTEND_URL=https://TU-FRONTEND.vercel.app
```

Railway redespliega automático.

---

## PASO 5 — Verificar que todo funciona

- [ ] `https://TU-BACKEND.up.railway.app/up` devuelve 200
- [ ] `https://TU-FRONTEND.vercel.app` carga la app
- [ ] Login funciona (la cookie llega cross-domain)
- [ ] Imágenes/archivos subidos se sirven correctamente
- [ ] Migraciones corridas (ver logs Railway)

---

## Problemas comunes

| Problema | Causa | Fix |
|---|---|---|
| CORS error en consola | `FRONTEND_URL` no configurado o mal | Verificar variable en Railway |
| Login no guarda sesión (401 en /auth/me) | Cookie cross-domain bloqueada | Verificar `SESSION_SECURE_COOKIE=true` + `SESSION_SAME_SITE=none` en Railway |
| 500 en Railway | `.env` mal / extensión PHP faltante | Ver logs en Railway dashboard |
| Build falla en Vercel | Falta `VITE_API_URL` | Añadir variable de entorno en Vercel |
| Imágenes no cargan | `storage:link` no ejecutado | El Procfile ya lo hace; verificar logs de arranque |
| `php artisan config:cache` falla en build | Variable de entorno referenciada en config no existe aún | Añadir todas las vars antes del primer deploy |

---

## Notas de arquitectura

- **Cookie auth**: en producción usa `secure=true` + `samesite=none` (necesario cross-domain HTTPS). En local sigue con `secure=false` + `samesite=lax`. Controlado en `AuthController.php` por `app()->environment('production')`.
- **CORS**: `cors.php` lee `FRONTEND_URL` del entorno — sin hardcodear URLs en código.
- **Storage**: archivos subidos van a `storage/app/public`. En Railway el filesystem es efímero — para producción real considerar S3/Cloudflare R2. Para el TFG es suficiente.
