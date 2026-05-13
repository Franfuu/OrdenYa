# Deploy OrdenYa — Guía Completa

Stack producción:
- **DB**: Clever Cloud MySQL (plan DEV, 10 MB free)
- **Backend**: Render (Docker, Web Service free, sleep tras 15min idle)
- **Frontend**: Vercel (Vite static, Hobby tier free)
- **Repo**: GitHub `Franfuu/OrdenYa`

URLs producción:
- Frontend: `https://orden-ya.vercel.app`
- Backend: `https://ordenya-backend.onrender.com`
- DB host: `bd8lngflylvtlldmjng2-mysql.services.clever-cloud.com`

Arquitectura:
```
[Browser] → [Vercel: frontend Vite] → [Render: backend Laravel Docker] → [Clever: MySQL]
```

---

## 1. Base de datos (Clever Cloud MySQL)

### Setup inicial (ya hecho)
1. Cuenta en https://console.clever-cloud.com (GitHub OAuth)
2. Añadir método de pago (no cobran en plan DEV, solo verifican tarjeta)
3. Sidebar → **Create** → **an add-on** → **MySQL**
4. Plan **DEV** (gratis, 10 MB, 5 conns) → región **Paris** → nombre `ordenya-db`
5. Credenciales en dashboard del addon (tab "Database Credentials")

### Credenciales actuales
```
Host:     bd8lngflylvtlldmjng2-mysql.services.clever-cloud.com
Port:     3306
DB:       bd8lngflylvtlldmjng2
User:     uxbifezshd8ltf1k
Password: (ver candado en Clever console)
```

### Conectar localmente (debug)
```bash
mysql -h bd8lngflylvtlldmjng2-mysql.services.clever-cloud.com -P 3306 -u uxbifezshd8ltf1k -p bd8lngflylvtlldmjng2
```

### Backup manual
```bash
mysqldump -h <HOST> -P 3306 -u <USER> -p <DB> > backup-$(date +%Y%m%d).sql
```

### Reset DB (cuidado, borra todo)
- Console Clever → addon → **Reset database**
- Luego desde local con `.env` apuntando a Clever:
  ```bash
  cd backend && php artisan migrate:fresh --seed
  ```

### Avisos plan DEV
- **10 MB límite total**. Tablas que crecen: `work_sessions`, `notifications`, `audit_logs`
- **5 conexiones simultáneas** máx
- Sin backups automáticos → hacer dumps manuales

---

## 2. Backend (Render)

### Setup inicial (ya hecho)
1. Repo conectado a GitHub
2. https://dashboard.render.com → **New** → **Blueprint** → seleccionar repo `OrdenYa`
3. Detecta `render.yaml` en raíz → crea servicio `ordenya-backend`
4. Rellenar env vars marcadas `sync: false` (ver tabla abajo)
5. Deploy automático en cada push a `main`

### Archivos clave (en el repo)
- `backend/Dockerfile` — imagen PHP 8.2-alpine + extensiones (`pdo_mysql`, `mbstring`, `bcmath`, `intl`, `zip`, `gd`, `opcache`)
- `backend/docker-start.sh` — entry script: limpia cache, cachea config/rutas, corre `migrate --force`, lanza `artisan serve`
- `backend/.dockerignore` — excluye `.env`, `vendor/`, `node_modules/`, `tests/`
- `render.yaml` — blueprint Render (servicio web Docker, plan free, región Frankfurt, healthcheck `/up`)

### Environment Variables (dashboard Render)
| Key | Value | Notas |
|---|---|---|
| `APP_NAME` | `OrdenYa` | |
| `APP_ENV` | `production` | |
| `APP_DEBUG` | `false` | |
| `APP_KEY` | `base64:LJEgYi/Z0MQCwOzOrPm0lBcjbF3upRKJzxt8+vPcn9w=` | Generado con `php artisan key:generate --show` |
| `APP_URL` | `https://ordenya-backend.onrender.com` | |
| `APP_LOCALE` | `es` | |
| `APP_FALLBACK_LOCALE` | `en` | |
| `LOG_CHANNEL` | `stderr` | Render captura stderr |
| `LOG_LEVEL` | `warning` | |
| `DB_CONNECTION` | `mysql` | |
| `DB_HOST` | `bd8lngflylvtlldmjng2-mysql.services.clever-cloud.com` | |
| `DB_PORT` | `3306` | |
| `DB_DATABASE` | `bd8lngflylvtlldmjng2` | |
| `DB_USERNAME` | `uxbifezshd8ltf1k` | |
| `DB_PASSWORD` | (de Clever) | |
| `SESSION_DRIVER` | `database` | |
| `CACHE_STORE` | `database` | |
| `QUEUE_CONNECTION` | `database` | |
| `BROADCAST_CONNECTION` | `log` | Reverb websockets desactivado en prod |
| `BCRYPT_ROUNDS` | `12` | |
| `FRONTEND_URL` | `https://orden-ya.vercel.app` | Para CORS (`config/cors.php` lo lee) |
| `SANCTUM_STATEFUL_DOMAINS` | `orden-ya.vercel.app` | Sin `https://`, sin slash |

### Health check
- Endpoint: `https://ordenya-backend.onrender.com/up` (Laravel 11+ built-in)
- Configurado en `render.yaml` como `healthCheckPath: /up`

### Cold start
Render free duerme tras 15 min sin tráfico. Primera request tarda ~30-50s. Para demo TFG: visitar la web 1 min antes.

---

## 3. Frontend (Vercel)

### Setup inicial (ya hecho)
1. https://vercel.com → **Add New** → **Project** → import `OrdenYa`
2. **Root Directory**: `frontend`
3. **Framework Preset**: Vite (auto)
4. **Environment Variables**:
   - `VITE_API_URL` = `https://ordenya-backend.onrender.com/api`
5. Deploy

### Archivos clave
- `frontend/.env.production` — `VITE_API_URL` para builds locales (Vercel usa env vars del dashboard, no este archivo)
- `frontend/vercel.json` — SPA rewrites (`/(.*) → /index.html`) para que rutas React no devuelvan 404

### Environment Variables (dashboard Vercel)
| Key | Value |
|---|---|
| `VITE_API_URL` | `https://ordenya-backend.onrender.com/api` |

---

## 4. Cómo hacer cambios en producción

### Flujo general
```
local → commit → push a main → Render + Vercel redeploy auto
```

Ambos servicios escuchan push a `main`:
- **Render**: rebuild Docker + reinicia container (~5-10 min)
- **Vercel**: rebuild Vite + deploy CDN (~2 min)

### Cambios backend (PHP/Laravel)
1. Editar código en `backend/`
2. Probar local: `cd backend && php artisan serve` (con `.env` apuntando a Clever o MySQL local)
3. Commit + push:
   ```bash
   git add backend/
   git commit -m "fix: descripción"
   git push
   ```
4. Render detecta push → rebuild auto (ver progreso en dashboard → ordenya-backend → Events)
5. Si hay nuevas migraciones, `docker-start.sh` las corre al arrancar

### Cambios frontend (React/Vite)
1. Editar en `frontend/src/`
2. Probar local: `cd frontend && npm run dev`
3. Build sanity check: `npm run build`
4. Commit + push → Vercel rebuild auto
5. Ver en dashboard Vercel → orden-ya → Deployments

### Cambiar una env var en producción
**Backend (Render):**
1. Dashboard → ordenya-backend → **Environment** → editar key/value → **Save Changes**
2. Redeploy automático

**Frontend (Vercel):**
1. Project → **Settings** → **Environment Variables** → editar
2. **Vercel NO redespliega auto al cambiar env**. Hay que:
   - Deployments → último → **⋯** → **Redeploy** (desmarcar "use existing build cache")
   - O hacer push commit dummy

### Añadir nueva migración
```bash
cd backend
php artisan make:migration nombre_migracion
# editar archivo en database/migrations/
git add database/migrations/
git commit -m "migration: descripción"
git push
```
Render corre `php artisan migrate --force` al arrancar (en `docker-start.sh`).

### Rollback
- **Render**: dashboard → Events → click deploy anterior → **Rollback to this deploy**
- **Vercel**: Deployments → click versión anterior → **Promote to Production**

### Debug en producción
**Backend logs Render:**
- Dashboard → ordenya-backend → **Logs** (tiempo real)
- Filtrar por nivel: warning, error

**Frontend logs Vercel:**
- Dashboard → orden-ya → **Logs** (casi vacío en SPA estático)
- Errores reales en DevTools del navegador (Console + Network)

**Shell remota Render (tier free lo permite):**
- Dashboard → ordenya-backend → **Shell**
- Útil para:
  ```bash
  php artisan tinker
  php artisan migrate:status
  php artisan route:list
  ```

### Operaciones DB en producción
**Resetear DB (cuidado):**
```bash
# Render Shell:
php artisan migrate:fresh --force --seed
```

**Solo seeders:**
```bash
php artisan db:seed --force
```

**Inspección con Tinker:**
```bash
php artisan tinker
>>> User::count()
>>> User::where('email','admin@admin.com')->first()
```

### Cambia el dominio frontend
Si cambias dominio Vercel (custom domain o renombras proyecto):
1. Render → Environment:
   - `FRONTEND_URL` = nuevo dominio (con `https://`)
   - `SANCTUM_STATEFUL_DOMAINS` = nuevo dominio (sin `https://`)
2. Save → redeploy auto

### Cambia el dominio backend
1. Vercel → Settings → Environment Variables:
   - `VITE_API_URL` = nueva URL + `/api`
2. Redeploy frontend manual desde Deployments
3. Render → Environment:
   - `APP_URL` = nueva URL

### Generar nueva APP_KEY (si comprometida)
```bash
cd backend
php artisan key:generate --show
# Copiar output base64:... a Render → APP_KEY → Save
```
**Aviso**: invalida sesiones existentes, todos deben volver a login.

---

## 5. Problemas comunes

| Problema | Causa | Fix |
|---|---|---|
| CORS error en consola navegador | `FRONTEND_URL` no configurado o mal | Verificar var en Render → Environment |
| Login 401 / no responde | `SANCTUM_STATEFUL_DOMAINS` mal o cold start | Verificar var + esperar al wake-up |
| 500 en backend | Falla extensión PHP o env mal | Logs Render → buscar stack trace |
| Build frontend falla | Falta `VITE_API_URL` o error TS | Logs Vercel → revisar |
| `SQLSTATE Connection refused` | DB creds mal o Clever caído | Verificar `DB_*` envs Render + status Clever |
| Imágenes uploadeadas desaparecen | Filesystem Render es efímero | Para prod real: usar S3/Cloudflare R2 |
| App tarda ~30s en responder | Cold start Render free | Normal. Upgrade a Starter $7/mes elimina sleep |
| `10 MB exceeded` Clever | Tablas crecieron mucho | Truncar `audit_logs`/`notifications` antiguos o upgrade |

---

## 6. Limitaciones del free tier

| Servicio | Límite | Workaround |
|---|---|---|
| Clever MySQL DEV | 10 MB | Upgrade S Small (~7€/mes) |
| Render Web free | Sleep 15min idle, 750h/mes | Starter ($7/mes) sin sleep |
| Vercel Hobby | 100 GB bandwidth/mes | Suficiente para TFG |

---

## 7. Checklist demo TFG

Antes de presentar:
- [ ] Visitar `https://orden-ya.vercel.app` 2 min antes para despertar backend
- [ ] Login con `admin@admin.com / admin123` → verificar
- [ ] Crear orden de prueba → flujo completo
- [ ] DevTools abierto por si hay que mostrar Network/Console
- [ ] CLI `mysql` listo por si piden ver DB en vivo

---

## 8. Usuarios seed (producción)

| Rol | Email | Password |
|---|---|---|
| admin | admin@admin.com | admin123 |
| supervisor (Taller) | carlos@supervisor.com | admin123 |
| supervisor (Instalación) | ana@supervisor.com | admin123 |
| trabajador (Taller) | maria@trabajador.com | admin123 |
| trabajador (Instalación) | luis@trabajador.com | admin123 |
| trabajador (Instalación) | marcos@trabajador.com | admin123 |

**Cambiar passwords antes de uso real (no TFG).**
