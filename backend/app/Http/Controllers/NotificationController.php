<?php

namespace App\Http\Controllers;

use App\Events\WorkOrdersChanged;
use App\Models\Notification;
use App\Models\WorkOrderDepartmentWorker;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class NotificationController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        return response()->json(
            Notification::where('user_id', $user->id)
                ->orderByDesc('created_at')
                ->limit(30)
                ->get()
        );
    }

    public function markAllRead(Request $request): JsonResponse
    {
        Notification::where('user_id', $request->user()->id)
            ->whereNull('read_at')
            ->update(['read_at' => now()]);
        return response()->json(['message' => 'OK']);
    }

    public function approve(Request $request, Notification $notification): JsonResponse
    {
        $user = $request->user();

        if ($notification->user_id !== $user->id) {
            return response()->json(['message' => 'No tienes permiso para esta notificación.'], 403);
        }
        if ($notification->type !== 'worker_completion_approval') {
            return response()->json(['message' => 'Tipo de notificación no aprobable.'], 422);
        }
        if ($notification->acted_at) {
            return response()->json(['message' => 'Esta notificación ya ha sido procesada.'], 422);
        }

        $workerId = $notification->data['work_order_department_worker_id'] ?? null;
        if (! $workerId) {
            return response()->json(['message' => 'Notificación sin datos válidos.'], 422);
        }

        $worker = WorkOrderDepartmentWorker::find($workerId);
        if (! $worker) {
            return response()->json(['message' => 'El registro del trabajador ya no existe.'], 404);
        }

        if (! $worker->approved_at) {
            $worker->update([
                'approved_at' => now(),
                'approved_by' => $user->id,
            ]);
        }

        $notification->update([
            'acted_at' => now(),
            'read_at' => $notification->read_at ?? now(),
        ]);

        // Notificar al trabajador
        $workerUserId = $notification->data['worker_user_id'] ?? null;
        $orderCode = $notification->data['codigo_orden'] ?? '';
        $deptName  = $notification->data['departamento'] ?? '';
        if ($workerUserId) {
            Notification::create([
                'user_id' => $workerUserId,
                'type' => 'worker_completion_approved',
                'title' => "Cuota aprobada",
                'body' => "Tu trabajo en {$orderCode} · {$deptName} ha sido aprobado.",
                'link' => "/trabajador/ordenes",
            ]);
        }

        try {
            broadcast(new WorkOrdersChanged('approved', $notification->data['work_order_id'] ?? null, [
                'worker_user_id' => $workerUserId,
                'work_order_department_id' => $notification->data['work_order_department_id'] ?? null,
            ]));
        } catch (\Throwable $e) {
            \Log::warning('Broadcast approve falló: ' . $e->getMessage());
        }

        return response()->json(['message' => 'Aprobado', 'notification' => $notification->fresh()]);
    }
}
