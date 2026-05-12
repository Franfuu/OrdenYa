# Despliegue: PlanetScale (DB) + Render (backend) + Render (frontend)

## Arquitectura

```
[Browser] → [Render Static Site: frontend] → [Render Web Service: backend Laravel] → [PlanetScale: MySQL]
```

## Cambios ya aplicados al código

| Archivo                                             | Cambio                                                     | Por qué                                                                           |
| --------------------------------------------------- | ---------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `backend/app/Http/Controllers/AuthController.php` | Cookie `secure` y `samesite` dinámicos según entorno | En producción cross-domain la cookie necesita `secure=true` + `samesite=none` |
| `backend/config/cors.php`                         | `allowed_origins` lee `FRONTEND_URL` del `.env`      | No hardcodear URL del frontend en código                                          |
| `backend/Procfile`                                | Comando de arranque                                        | Render usa Procfile para lanzar Laravel                                            |
| `backend/nixpacks.toml`                           | Extensiones PHP + build + start                            | Render usa nixpacks para compilar                                                  |

---

## Requisitos previos

- Repo subido a GitHub
- Cuenta en [planetscale.com](https://planetscale.com)
- 
- Cuenta en [render.com](https://render.com)

---

## PASO 1 — Base de datos en PlanetScale

1. planetscale.com → **New database**
   - Name: `tfg-daw`
   - Region: `AWS eu-west-1` (Irlanda, más cercana)
2. Espera que termine de crear (~1 min)
3. **Connect** → **Connect with**: Laravel
4. Copia las credenciales que aparecen:
   ```
   DB_HOST=...
   DB_USERNAME=...
   DB_PASSWORD=...
   DB_DATABASE=...
   ```
5. En PlanetScale → Settings → **Allow web console connections**: ON

> PlanetScale usa SSL por defecto. Laravel lo maneja automático con el driver mysql.

---

## PASO 2 — Backend Laravel en Render

### 2.1 Crear Web Service

1. render.com → **New** → **Web Service**
2. Conecta tu repo de GitHub
3. Configura:
   - **Name**: `tfg-backend`
   - **Root Directory**: `backend`
   - **Runtime**: `Node` → cambia a **Native Runtime** o deja que nixpacks lo detecte
   - **Build Command**: (dejar vacío — nixpacks.toml lo gestiona)
   - **Start Command**: (dejar vacío — Procfile lo gestiona)
   - **Plan**: Free

### 2.2 Variables de entorno

En el servicio → **Environment** → añadir:

```env
APP_ENV=production
APP_DEBUG=false
APP_URL=https://tfg-backend.onrender.com
APP_KEY=                          # ver paso 2.3

DB_CONNECTION=mysql
DB_HOST=TU_HOST_PLANETSCALE
DB_PORT=3306
DB_DATABASE=TU_DATABASE
DB_USERNAME=TU_USERNAME
DB_PASSWORD=TU_PASSWORD
MYSQL_ATTR_SSL_CA=/etc/ssl/certs/ca-certificates.crt

SESSION_DRIVER=database
SESSION_LIFETIME=120
SESSION_SECURE_COOKIE=true
SESSION_SAME_SITE=none

FILESYSTEM_DISK=local
FRONTEND_URL=https://tfg-frontend.onrender.com   # actualizar tras paso 3
```

### 2.3 Generar APP_KEY

Ejecutar localmente:

```bash
cd backend
php artisan key:generate --show
```

Copiar resultado (`base64:...`) como valor de `APP_KEY`.

### 2.4 Deploy

- Render despliega automático. Ver logs.
- URL pública: `https://tfg-backend.onrender.com`
- Verificar: `https://tfg-backend.onrender.com/up` → debe devolver 200

---

## PASO 3 — Frontend en Render

1. render.com → **New** → **Static Site**
2. Conecta el mismo repo de GitHub
3. Configura:
   - **Name**: `tfg-frontend`
   - **Root Directory**: `frontend`
   - **Build Command**: `npm install && npm run build`
   - **Publish Directory**: `dist`
4. **Environment Variables**:
   ```env
   VITE_API_URL=https://tfg-backend.onrender.com/api
   ```
5. **Deploy** → URL: `https://tfg-frontend.onrender.com`

---

## PASO 4 — Actualizar FRONTEND_URL en backend

Render → servicio backend → **Environment** → actualiza:

```env
FRONTEND_URL=https://tfg-frontend.onrender.com
```

Render redespliega automático.

---

## PASO 5 — Verificar

- [ ] `https://tfg-backend.onrender.com/up` devuelve 200
- [ ] `https://tfg-frontend.onrender.com` carga la app
- [ ] Login funciona (cookie cross-domain)
- [ ] Migraciones corridas (ver logs Render)
- [ ] Imágenes/archivos subidos se sirven correctamente

---

## Problemas comunes

| Problema                                  | Causa                                   | Fix                                                                   |
| ----------------------------------------- | --------------------------------------- | --------------------------------------------------------------------- |
| CORS error en consola                     | `FRONTEND_URL` no configurado o mal   | Verificar variable en Render backend                                  |
| Login no guarda sesión (401 en /auth/me) | Cookie cross-domain bloqueada           | Verificar `SESSION_SECURE_COOKIE=true` + `SESSION_SAME_SITE=none` |
| 500 en Render                             | `.env` mal / extensión PHP faltante  | Ver logs en Render dashboard                                          |
| Build falla frontend                      | Falta `VITE_API_URL`                  | Añadir variable en Render Static Site                                |
| Imágenes no cargan                       | `storage:link` no ejecutado           | Procfile ya lo hace; verificar logs de arranque                       |
| Error SSL PlanetScale                     | Falta `MYSQL_ATTR_SSL_CA`             | Añadir la variable de entorno SSL                                    |
| App tarda en responder                    | Plan free duerme tras 15min inactividad | Normal en plan free; plan paid elimina el sleep                       |

---

## Notas

- **Cookie auth**: producción usa `secure=true` + `samesite=none` (necesario cross-domain HTTPS). Local usa `secure=false` + `samesite=lax`. Controlado en `AuthController.php` por `app()->environment('production')`.
- **CORS**: `cors.php` lee `FRONTEND_URL` del entorno.
- **Storage**: archivos en `storage/app/public`. Render filesystem es efímero — se pierden al redesplegar. Para el TFG es suficiente; para producción real usar S3/Cloudflare R2.
- **Plan free Render**: backend duerme tras 15min sin tráfico → primera petición tarda ~30s en despertar.
