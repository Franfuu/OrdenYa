<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Models\WorkOrder;
use App\Models\WorkSession;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rule;

class UserController extends Controller
{
    /**
     * Devuelve el perfil del usuario autenticado.
     */
    public function myProfile(Request $request): JsonResponse
    {
        return response()->json($request->user());
    }

    /**
     * Actualiza el perfil del usuario autenticado.
     * No permite cambiar el rol (solo el admin puede hacerlo via update()).
     */
    public function updateProfile(Request $request): JsonResponse
    {
        $user = $request->user();

        $validated = $request->validate([
            'name' => 'sometimes|required|string|max:255',
            'email' => ['sometimes', 'required', 'string', 'email', 'max:255', Rule::unique('users')->ignore($user->id)],
            'password' => 'sometimes|required|string|min:8',
        ]);

        if (isset($validated['password'])) {
            $validated['password'] = Hash::make($validated['password']);
        }

        $user->update($validated);

        return response()->json($user);
    }

    /**
     * Listar todos los usuarios.
     */
    public function index(): JsonResponse
    {
        $users = User::all();

        return response()->json($users);
    }

    /**
     * Crear un nuevo usuario.
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|string|email|max:255|unique:users,email',
            'password' => 'required|string|min:8',
            'role' => ['nullable', Rule::in(['admin', 'supervisor', 'trabajador', 'jefe'])],
            'departamento' => ['nullable', Rule::in(['Taller', 'Instalacion'])],
        ]);

        $validated['password'] = Hash::make($validated['password']);

        $user = User::create($validated);

        return response()->json($user, 201);
    }

    /**
     * Mostrar un usuario específico.
     */
    public function show(User $user): JsonResponse
    {
        return response()->json($user);
    }

    /**
     * Actualizar un usuario.
     */
    public function update(Request $request, User $user): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'sometimes|required|string|max:255',
            'email' => ['sometimes', 'required', 'string', 'email', 'max:255', Rule::unique('users')->ignore($user->id)],
            'password' => 'sometimes|required|string|min:8',
            'role' => ['nullable', Rule::in(['admin', 'supervisor', 'trabajador', 'jefe'])],
            'departamento' => ['nullable', Rule::in(['Taller', 'Instalacion'])],
        ]);

        if (isset($validated['password'])) {
            $validated['password'] = Hash::make($validated['password']);
        }

        $user->update($validated);

        return response()->json($user);
    }

    public function destroy(Request $request, User $user): JsonResponse
    {
        $authUser = $request->user();
        if ($authUser && $authUser->id === $user->id) {
            return response()->json(['message' => 'No puedes eliminar tu propia cuenta.'], 403);
        }
        if ($user->role === 'admin') {
            $adminCount = User::where('role', 'admin')->count();
            if ($adminCount <= 1) {
                return response()->json(['message' => 'No puedes eliminar el único administrador del sistema.'], 403);
            }
        }
        $user->delete();
        return response()->json(null, 204);
    }

    /**
     * Get sessions for a user, optionally filtered by date.
     */
    public function sessions(Request $request, User $user): JsonResponse
    {
        $authUser = $request->user();

        // Authorization: Only yourself or an admin/supervisor
        if ($authUser->id !== $user->id && ! in_array($authUser->role, ['admin', 'supervisor', 'jefe'])) {
            return response()->json(['message' => 'No tienes permiso para ver el diario de otro usuario.'], 403);
        }

        $date = $request->query('date', now()->toDateString());

        $sessions = $user->workSessions()
            ->with([
                'workOrder:id,codigo_orden,nombre_orden',
                'workOrderDepartment.department:id,name,slug',
                'workOrderPhase.phase:id,name,slug',
            ])
            ->whereDate('start_time', $date)
            ->orderBy('start_time', 'desc')
            ->get();

        return response()->json($sessions);
    }

    /**
     * Get aggregated stats for a user: total hours, piezas, orders with time spent.
     */
    public function stats(Request $request, User $user): JsonResponse
    {
        $authUser = $request->user();

        // Sólo el propio usuario o un admin pueden ver las stats
        if ($authUser->id !== $user->id && $authUser->role !== 'admin') {
            return response()->json(['message' => 'No tienes permiso.'], 403);
        }

        $from = $request->query('from');
        $to = $request->query('to');

        $baseQuery = fn () => $user->workSessions()
            ->with('workOrder:id,codigo_orden,nombre_orden')
            ->when($from, fn ($q) => $q->whereDate('start_time', '>=', $from))
            ->when($to, fn ($q) => $q->whereDate('start_time', '<=', $to));

        $sessions = $baseQuery()->whereNotNull('end_time')->get();
        $activeSessions = $baseQuery()->whereNull('end_time')->get();

        $orderMap = [];

        foreach ($sessions as $session) {
            $orderId = $session->work_order_id;
            if (! isset($orderMap[$orderId])) {
                $orderMap[$orderId] = [
                    'work_order_id' => $orderId,
                    'codigo_orden' => $session->workOrder?->codigo_orden ?? '—',
                    'nombre_orden' => $session->workOrder?->nombre_orden ?? '—',
                    'total_seconds' => 0,
                    'total_piezas' => 0,
                    'sessions_count' => 0,
                ];
            }
            $orderMap[$orderId]['total_seconds'] += $session->duration_in_seconds ?? 0;
            $orderMap[$orderId]['total_piezas'] += $session->piezas ?? 0;
            $orderMap[$orderId]['sessions_count'] += 1;
        }

        foreach ($activeSessions as $session) {
            $orderId = $session->work_order_id;
            if (! isset($orderMap[$orderId])) {
                $orderMap[$orderId] = [
                    'work_order_id' => $orderId,
                    'codigo_orden' => $session->workOrder?->codigo_orden ?? '—',
                    'nombre_orden' => $session->workOrder?->nombre_orden ?? '—',
                    'total_seconds' => 0,
                    'total_piezas' => 0,
                    'sessions_count' => 0,
                ];
            }
            $orderMap[$orderId]['total_seconds'] += $session->duration_in_seconds ?? 0;
            $orderMap[$orderId]['sessions_count'] += 1;
        }

        return response()->json([
            'user_id' => $user->id,
            'name' => $user->name,
            'total_seconds' => array_sum(array_column($orderMap, 'total_seconds')),
            'total_piezas' => array_sum(array_column($orderMap, 'total_piezas')),
            'orders' => array_values($orderMap),
        ]);
    }

    /**
     * Get all sessions for a specific user on a specific work order.
     */
    public function orderSessions(Request $request, User $user, WorkOrder $workOrder): JsonResponse
    {
        $authUser = $request->user();

        if ($authUser->id !== $user->id && ! in_array($authUser->role, ['admin', 'supervisor', 'jefe'])) {
            return response()->json(['message' => 'No tienes permiso.'], 403);
        }

        $from = $request->query('from');
        $to = $request->query('to');

        $sessions = $user->workSessions()
            ->with([
                'workOrderDepartment.department:id,name,slug',
                'workOrderPhase.phase:id,name,slug',
            ])
            ->where('work_order_id', $workOrder->id)
            ->when($from, fn ($q) => $q->whereDate('start_time', '>=', $from))
            ->when($to, fn ($q) => $q->whereDate('start_time', '<=', $to))
            ->orderBy('start_time', 'asc')
            ->get()
            ->map(fn ($s) => [
                'id' => $s->id,
                'start_time' => $s->start_time,
                'end_time' => $s->end_time,
                'duration_in_seconds' => $s->duration_in_seconds,
                'piezas' => $s->piezas ?? 0,
                'department_name' => $s->workOrderDepartment?->department?->name,
                'phase_name' => $s->workOrderPhase?->phase?->name,
                'work_order_department_id' => $s->work_order_department_id,
                'work_order_phase_id' => $s->work_order_phase_id,
            ]);

        return response()->json($sessions);
    }

    /**
     * Log global de fichajes para admin: todas las sesiones con filtros.
     */
    public function fichajesLog(Request $request): JsonResponse
    {
        $from = $request->query('from');
        $to = $request->query('to');
        $userId = $request->query('user_id');
        $orderId = $request->query('work_order_id');

        $sessions = WorkSession::with([
            'user:id,name,role',
            'workOrder:id,codigo_orden,nombre_orden',
            'workOrderDepartment.department:id,name,slug',
            'workOrderPhase.phase:id,name,slug',
            'logs.modifier:id,name,role',
        ])
            ->whereHas('user', fn ($q) => $q->whereNotIn('role', ['admin', 'jefe']))
            ->when($from, fn ($q) => $q->whereDate('start_time', '>=', $from))
            ->when($to, fn ($q) => $q->whereDate('start_time', '<=', $to))
            ->when($userId, fn ($q) => $q->where('user_id', $userId))
            ->when($orderId, fn ($q) => $q->where('work_order_id', $orderId))
            ->orderBy('start_time', 'desc')
            ->get()
            ->map(fn ($s) => [
                'id' => $s->id,
                'user' => $s->user,
                'work_order' => $s->workOrder,
                'start_time' => $s->start_time,
                'end_time' => $s->end_time,
                'duration_in_seconds' => $s->duration_in_seconds,
                'piezas' => $s->piezas ?? 0,
                'department_name' => $s->workOrderDepartment?->department?->name,
                'phase_name' => $s->workOrderPhase?->phase?->name,
                'modificada' => $s->logs->isNotEmpty(),
                'logs' => $s->logs->map(fn ($l) => [
                    'modified_by' => $l->modifier,
                    'changes' => $l->changes,
                    'at' => $l->created_at,
                ]),
            ]);

        return response()->json($sessions);
    }
}
