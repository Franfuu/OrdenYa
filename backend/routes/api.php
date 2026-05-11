<?php

use App\Http\Controllers\AuthController;
use App\Http\Controllers\AuditLogController;
use App\Http\Controllers\CommentController;
use App\Http\Controllers\NotificationController;
use App\Http\Controllers\PiezaController;
use App\Http\Controllers\UserController;
use App\Http\Controllers\WorkOrderController;
use Illuminate\Support\Facades\Route;

Route::post('/auth/login', [AuthController::class, 'login'])->middleware('throttle:10,1');

Route::middleware('auth:sanctum')->group(function () {
    Route::get('/auth/me', [AuthController::class, 'me']);
    Route::post('/auth/logout', [AuthController::class, 'logout']);
    Route::put('/auth/profile', [UserController::class, 'updateProfile']);
    Route::get('/auth/profile', [UserController::class, 'myProfile']);
    Route::get('/users/{user}/sessions', [UserController::class, 'sessions']);
    Route::get('/users/{user}/stats', [UserController::class, 'stats']);
    Route::get('/users/{user}/orders/{workOrder}/sessions', [UserController::class, 'orderSessions']);

    // Comentarios + Audit + Notificaciones
    Route::get('work-orders/{workOrder}/comments', [CommentController::class, 'index']);
    Route::post('work-orders/{workOrder}/comments', [CommentController::class, 'store']);
    Route::delete('comments/{comment}', [CommentController::class, 'destroy']);
    Route::get('work-orders/{workOrder}/audit', [AuditLogController::class, 'forOrder']);
    Route::get('notifications', [NotificationController::class, 'index']);
    Route::post('notifications/mark-all-read', [NotificationController::class, 'markAllRead']);

    // Read: all roles
    Route::middleware('role:admin,supervisor,trabajador')->group(function () {
        Route::get('work-orders', [WorkOrderController::class, 'index']);
        Route::get('work-orders/{workOrder}', [WorkOrderController::class, 'show']);
        Route::get('piezas', [PiezaController::class, 'index']);
        Route::get('piezas/{pieza}', [PiezaController::class, 'show']);
    });

    // Lectura de usuarios — admin + supervisor (necesario para asignar trabajadores)
    Route::middleware('role:admin,supervisor')->group(function () {
        Route::get('users', [UserController::class, 'index']);
        Route::get('users/{user}', [UserController::class, 'show']);
    });

    // Operaciones de sesión: trabajador + supervisor
    Route::middleware('role:trabajador,supervisor')->group(function () {
        Route::post('work-orders/generic-start', [WorkOrderController::class, 'startGenericSession']);
        Route::post('work-orders/{workOrder}/start', [WorkOrderController::class, 'startSession']);
        Route::post('work-orders/{workOrder}/pause', [WorkOrderController::class, 'pauseSession']);
        Route::post('work-orders/{workOrder}/stop', [WorkOrderController::class, 'stopSession']);
        Route::post('work-orders/{workOrder}/manual-session', [WorkOrderController::class, 'manualSession']);
        Route::put('work-sessions/{session}', [WorkOrderController::class, 'updateSession']);
    });

    // Finalizar departamento — admin + supervisor (cierre operativo de fases)
    Route::middleware('role:admin,supervisor')->group(function () {
        Route::post('work-orders/{workOrder}/finalize-department', [WorkOrderController::class, 'finalizeDepartment']);
    });

    // ── ADMIN ONLY: gestión completa de órdenes, piezas y usuarios ──
    Route::middleware('role:admin')->group(function () {
        // Órdenes (crear, editar, eliminar, duplicar, lote, foto)
        Route::post('work-orders', [WorkOrderController::class, 'store']);
        Route::put('work-orders/{workOrder}', [WorkOrderController::class, 'update']);
        Route::delete('work-orders/{workOrder}', [WorkOrderController::class, 'destroy']);
        Route::post('work-orders/{workOrder}/duplicate', [WorkOrderController::class, 'duplicate']);
        Route::post('work-orders/bulk', [WorkOrderController::class, 'bulkAction']);
        Route::post('work-orders/{workOrder}/upload-image', [WorkOrderController::class, 'uploadImage']);

        // Catálogo de piezas (CRUD)
        Route::post('piezas', [PiezaController::class, 'store']);
        Route::put('piezas/{pieza}', [PiezaController::class, 'update']);
        Route::delete('piezas/{pieza}', [PiezaController::class, 'destroy']);

        // Usuarios (CRUD)
        Route::post('users', [UserController::class, 'store']);
        Route::put('users/{user}', [UserController::class, 'update']);
        Route::delete('users/{user}', [UserController::class, 'destroy']);
    });

});
