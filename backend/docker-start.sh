#!/bin/sh
set -e

php artisan config:clear
php artisan route:clear
php artisan view:clear

php artisan config:cache
php artisan route:cache

php artisan migrate --force --no-interaction || true

exec php artisan serve --host=0.0.0.0 --port="${PORT:-8000}"
