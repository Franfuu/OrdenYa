<?php

namespace App\Http\Controllers;

use App\Models\Department;
use App\Models\User;
use App\Models\WorkOrder;
use App\Models\WorkOrderDepartment;
use App\Models\WorkOrderDepartmentWorker;
use App\Models\WorkSession;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use App\Models\AuditLog;
use App\Models\Notification;
use App\Events\WorkOrdersChanged;

class WorkOrderController extends Controller
{
    private function orderWith(): array
    {
        return [
            'pieza',
            'departments.department',
            'departments.phases.phase',
            'departments.workers.user',
            'workSessions.user',
        ];
    }

    // ─── WORK ORDERS ───

    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $query = WorkOrder::with($this->orderWith());

        if ($user->role === 'trabajador') {
            $query->where(function ($q) use ($user) {
                $q->whereHas('departments.workers', fn ($q2) => $q2->where('user_id', $user->id))
                    ->orWhereHas('workSessions', fn ($q2) => $q2->where('user_id', $user->id)->whereNull('end_time'));
            });
        } else {
            $query->where('codigo_orden', 'not like', 'GEN-%');
            $allowedSlugs = $this->allowedDeptSlugsForUser($user);
            if ($allowedSlugs !== null) {
                $query->whereHas('departments.department', fn ($q) => $q->whereIn('slug', $allowedSlugs));
            }
        }

        return response()->json($query->orderByDesc('created_at')->get());
    }

    public function show(Request $request, WorkOrder $workOrder): JsonResponse
    {
        $user = $request->user();
        if ($user && $user->role === 'trabajador') {
            $isAssigned = $workOrder->departments()
                ->whereHas('workers', fn ($q) => $q->where('user_id', $user->id))
                ->exists();
            $hasSession = $workOrder->workSessions()->where('user_id', $user->id)->exists();
            if (! $isAssigned && ! $hasSession) {
                return response()->json(['message' => 'No tienes acceso a esta orden.'], 403);
            }
        }
        if ($user && $user->role === 'supervisor') {
            $allowedSlugs = $this->allowedDeptSlugsForUser($user);
            if ($allowedSlugs !== null) {
                $matches = $workOrder->departments()
                    ->whereHas('department', fn ($q) => $q->whereIn('slug', $allowedSlugs))
                    ->exists();
                if (! $matches) {
                    return response()->json(['message' => 'No tienes acceso a esta orden.'], 403);
                }
            }
        }
        $workOrder->load($this->orderWith());
        return response()->json($workOrder);
    }

    private function allowedDeptSlugsForUser($user): ?array
    {
        if (! $user || $user->role !== 'supervisor') return null; // null = sin restricción
        return match (strtolower((string) $user->departamento)) {
            'taller'      => ['taller'],
            'instalacion', 'instalación' => ['instalacion'],
            'general', ''  => null, // supervisor general → ve todo
            default       => null,
        };
    }

    public function store(Request $request): JsonResponse
    {
        $user = $request->user();
        $allowedSlugs = $this->allowedDeptSlugsForUser($user);
        if ($allowedSlugs !== null) {
            if (empty($allowedSlugs)) {
                return response()->json(['message' => 'Tu cuenta de supervisor no tiene un departamento asignado.'], 403);
            }
            $reqDepts = (array) $request->input('departments', []);
            $invalid = array_diff($reqDepts, $allowedSlugs);
            if (! empty($invalid)) {
                return response()->json([
                    'message' => 'Solo puedes crear órdenes para tu departamento (' . implode(', ', $allowedSlugs) . ').',
                ], 403);
            }
            if (empty($reqDepts)) {
                // Forzar el dept del supervisor si no envió ninguno
                $request->merge(['departments' => $allowedSlugs]);
            }
        }

        $validated = $request->validate([
            'tipo' => ['nullable', Rule::in(['HL', 'TE'])],
            'codigo_orden' => 'required|string|max:255|unique:work_orders,codigo_orden',
            'nombre_orden' => 'required|string',
            'fecha_inicio' => 'nullable|date',
            'fecha_fin' => 'nullable|date|after_or_equal:fecha_inicio',
            'unidades' => 'nullable|integer|min:1',
            'pieza_id' => 'nullable|integer|exists:piezas,id',
            'prioridad' => ['nullable', Rule::in(['baja', 'media', 'alta'])],
            'festividad' => 'nullable|string|max:255',
            'numero_pedido' => 'nullable|integer|min:0',
            'codigo_cliente' => 'nullable|integer|min:0',
            'nombre_cliente' => 'nullable|string|max:255',
            'modelo' => 'nullable|string|max:255',
            'numero_op' => 'nullable|string|max:255',
            'observacion' => 'nullable|string',
            'hl_referencia_id' => 'nullable|integer|exists:hl_referencias,id',
            // Active departments: array of dept slugs
            'departments' => 'nullable|array',
            'departments.*' => 'string|exists:departments,slug',
            // Optional: which phases to activate per dept { dept_slug: ['phase_slug', ...] }
            'department_phases' => 'nullable|array',
            // Target pieces per dept: { dept_slug: integer }
            'department_piezas' => 'nullable|array',
            'department_piezas.*' => 'nullable|integer|min:0',
            // Workers per dept: { dept_slug: [user_id, ...] }
            'department_workers' => 'nullable|array',
        ]);

        return DB::transaction(function () use ($validated) {
            $orderFields = collect($validated)
                ->except(['departments', 'department_phases', 'department_piezas', 'department_workers'])
                ->toArray();

            $workOrder = WorkOrder::create($orderFields);
            $frontendUrl = rtrim(env('FRONTEND_URL', 'http://localhost:5173'), '/');
            $workOrder->qr_codigo = "{$frontendUrl}/trabajador/ordenes/{$workOrder->id}";
            $workOrder->save();

            foreach (($validated['departments'] ?? []) as $deptSlug) {
                $this->activateDepartment($workOrder, $deptSlug, $validated);
            }

            AuditLog::log(request()->user()?->id, 'created', 'WorkOrder', $workOrder->id, "Orden {$workOrder->codigo_orden} creada");
            $this->notifyAssignedWorkers($workOrder, "Nueva orden asignada: {$workOrder->codigo_orden}");

            $workOrder->load($this->orderWith());
            $this->broadcastChange('created', $workOrder->id);

            return response()->json($workOrder, 201);
        });
    }

    public function duplicate(WorkOrder $workOrder): JsonResponse
    {
        return DB::transaction(function () use ($workOrder) {
            $base = $workOrder->codigo_orden;
            $i = 1;
            do {
                $newCode = $base . '-COPY' . ($i > 1 ? $i : '');
                $i++;
            } while (WorkOrder::where('codigo_orden', $newCode)->exists());

            $new = $workOrder->replicate();
            $new->codigo_orden = $newCode;
            $new->qr_codigo = null;
            $new->save();
            $frontendUrl = rtrim(env('FRONTEND_URL', 'http://localhost:5173'), '/');
            $new->qr_codigo = "{$frontendUrl}/trabajador/ordenes/{$new->id}";
            $new->save();

            foreach ($workOrder->departments as $dept) {
                $newDept = $new->departments()->create(['department_id' => $dept->department_id]);
                foreach ($dept->phases as $phase) {
                    $newDept->phases()->create(['phase_id' => $phase->phase_id, 'is_active' => $phase->is_active]);
                }
                foreach ($dept->workers as $worker) {
                    $newDept->workers()->create(['user_id' => $worker->user_id]);
                }
            }

            AuditLog::log(request()->user()?->id, 'duplicated', 'WorkOrder', $new->id, "Duplicada desde {$workOrder->codigo_orden}");
            $this->notifyAssignedWorkers($new, "Nueva orden duplicada: {$new->codigo_orden}");

            $new->load($this->orderWith());
            $this->broadcastChange('created', $new->id);
            return response()->json($new, 201);
        });
    }

    public function bulkAction(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'action' => ['required', Rule::in(['delete', 'set_prioridad'])],
            'ids' => 'required|array|min:1',
            'ids.*' => 'integer|exists:work_orders,id',
            'prioridad' => ['required_if:action,set_prioridad', Rule::in(['baja', 'media', 'alta'])],
        ]);

        $userId = $request->user()->id;
        $orders = WorkOrder::whereIn('id', $validated['ids'])->get();
        $count = 0;

        if ($validated['action'] === 'delete') {
            foreach ($orders as $o) {
                $code = $o->codigo_orden;
                $o->delete();
                AuditLog::log($userId, 'deleted', 'WorkOrder', $o->id, "Eliminada en lote: {$code}");
                $count++;
            }
            $this->broadcastChange('deleted');
            return response()->json(['message' => "{$count} órdenes eliminadas", 'count' => $count]);
        }

        if ($validated['action'] === 'set_prioridad') {
            foreach ($orders as $o) {
                $o->update(['prioridad' => $validated['prioridad']]);
                AuditLog::log($userId, 'updated', 'WorkOrder', $o->id, "Prioridad → {$validated['prioridad']} (lote)");
                $count++;
            }
            $this->broadcastChange('updated');
            return response()->json(['message' => "{$count} órdenes actualizadas", 'count' => $count]);
        }

        return response()->json(['message' => 'Acción no soportada'], 422);
    }

    private function broadcastChange(string $action, ?int $workOrderId = null, array $meta = []): void
    {
        try {
            broadcast(new WorkOrdersChanged($action, $workOrderId, $meta));
        } catch (\Throwable $e) {
            \Log::warning('Broadcast WorkOrdersChanged falló: ' . $e->getMessage());
        }
    }

    private function notifyAssignedWorkers(WorkOrder $workOrder, string $title): void
    {
        $userIds = [];
        foreach ($workOrder->departments as $dept) {
            foreach ($dept->workers as $w) {
                $userIds[$w->user_id] = true;
            }
        }
        foreach (array_keys($userIds) as $uid) {
            Notification::create([
                'user_id' => $uid,
                'title' => $title,
                'body' => $workOrder->nombre_orden,
                'link' => "/trabajador/ordenes",
            ]);
        }
    }

    public function update(Request $request, WorkOrder $workOrder): JsonResponse
    {
        $validated = $request->validate([
            'tipo' => ['sometimes', 'nullable', Rule::in(['HL', 'TE'])],
            'codigo_orden' => ['sometimes', 'required', 'string', 'max:255', Rule::unique('work_orders')->ignore($workOrder->id)],
            'nombre_orden' => 'sometimes|required|string',
            'fecha_inicio' => 'nullable|date',
            'fecha_fin' => 'nullable|date|after_or_equal:fecha_inicio',
            'unidades' => 'nullable|integer|min:1',
            'pieza_id' => 'nullable|integer|exists:piezas,id',
            'prioridad' => ['nullable', Rule::in(['baja', 'media', 'alta'])],
            'festividad' => 'nullable|string|max:255',
            'numero_pedido' => 'nullable|integer|min:0',
            'codigo_cliente' => 'nullable|integer|min:0',
            'nombre_cliente' => 'nullable|string|max:255',
            'modelo' => 'nullable|string|max:255',
            'numero_op' => 'nullable|string|max:255',
            'observacion' => 'nullable|string',
            'hl_referencia_id' => 'nullable|integer|exists:hl_referencias,id',
            'departments' => 'nullable|array',
            'departments.*' => 'string|exists:departments,slug',
            'department_phases' => 'nullable|array',
            'department_piezas' => 'nullable|array',
            'department_piezas.*' => 'nullable|integer|min:0',
            'department_workers' => 'nullable|array',
        ]);

        DB::transaction(function () use ($validated, $workOrder) {
            $fields = collect($validated)
                ->except(['departments', 'department_phases', 'department_piezas', 'department_workers'])
                ->toArray();
            $workOrder->update($fields);

            if (array_key_exists('departments', $validated)) {
                $newSlugs = $validated['departments'] ?? [];
                $existing = $workOrder->departments()->with('department')->get();
                $existingBySlug = $existing->keyBy(fn ($d) => $d->department?->slug);

                // Remove depts no longer selected
                foreach ($existingBySlug as $slug => $dept) {
                    if (in_array($slug, $newSlugs, true)) continue;
                    if ($dept->workSessions()->exists()) continue; // keep if has sessions
                    $dept->phases()->delete();
                    $dept->workers()->delete();
                    $dept->delete();
                }

                // Add new depts + sync workers on existing
                foreach ($newSlugs as $slug) {
                    if ($existingBySlug->has($slug)) {
                        $deptRow = $existingBySlug->get($slug);
                        $workerIds = $validated['department_workers'][$slug] ?? [];
                        $deptRow->workers()->whereNotIn('user_id', $workerIds)->delete();
                        foreach ($workerIds as $uid) {
                            $deptRow->workers()->firstOrCreate(['user_id' => $uid], ['piezas_asignadas' => 0]);
                        }
                    } else {
                        $this->activateDepartment($workOrder, $slug, $validated);
                    }
                }
            }
        });

        AuditLog::log($request->user()?->id, 'updated', 'WorkOrder', $workOrder->id, "Orden {$workOrder->codigo_orden} actualizada");
        $workOrder->load($this->orderWith());
        $this->broadcastChange('updated', $workOrder->id);

        return response()->json($workOrder);
    }

    public function uploadImage(Request $request, WorkOrder $workOrder): JsonResponse
    {
        $request->validate(['imagen' => 'required|file|image|max:10240']);

        if ($workOrder->imagen && str_contains($workOrder->imagen, '/storage/work-orders/')) {
            Storage::disk('public')->delete('work-orders/' . basename($workOrder->imagen));
        }

        $path = $request->file('imagen')->store('work-orders', 'public');
        $workOrder->update(['imagen' => url(Storage::url($path))]);
        $workOrder->load($this->orderWith());

        return response()->json($workOrder);
    }

    public function destroy(WorkOrder $workOrder): JsonResponse
    {
        $activeSessions = WorkSession::where('work_order_id', $workOrder->id)
            ->whereNull('end_time')
            ->count();

        if ($activeSessions > 0) {
            return response()->json([
                'message' => "No se puede eliminar: hay {$activeSessions} sesión(es) activa(s) en esta orden.",
            ], 422);
        }

        $code = $workOrder->codigo_orden;
        $id = $workOrder->id;
        $workOrder->delete();
        AuditLog::log(request()->user()?->id, 'deleted', 'WorkOrder', $id, "Orden {$code} eliminada");
        $this->broadcastChange('deleted', $id);

        return response()->json(null, 204);
    }

    private function activateDepartment(WorkOrder $workOrder, string $deptSlug, array $validated): WorkOrderDepartment
    {
        $dept = Department::where('slug', $deptSlug)->firstOrFail();

        $deptData = ['department_id' => $dept->id];
        $workOrderDept = $workOrder->departments()->create($deptData);

        // Determine which phases to activate
        $requestedSlugs = $validated['department_phases'][$deptSlug] ?? null;

        foreach ($dept->phases as $phase) {
            if ($requestedSlugs !== null) {
                if (! in_array($phase->slug, $requestedSlugs)) continue;
            } else {
                if ($phase->is_optional) continue;
            }
            $workOrderDept->phases()->create(['phase_id' => $phase->id, 'is_active' => true]);
        }

        // Assign workers, dividing total units equally among them
        $workerIds = $validated['department_workers'][$deptSlug] ?? [];
        $unidades = (int) ($workOrder->unidades ?? 0);
        $numWorkers = count($workerIds);
        $base = $numWorkers > 0 ? intdiv($unidades, $numWorkers) : 0;
        $resto = $numWorkers > 0 ? $unidades % $numWorkers : 0;
        foreach ($workerIds as $i => $uid) {
            $asignadas = $base + ($i < $resto ? 1 : 0);
            $existing = $workOrderDept->workers()->where('user_id', $uid)->first();
            if ($existing) {
                $existing->update(['piezas_asignadas' => $asignadas]);
            } else {
                $workOrderDept->workers()->create(['user_id' => $uid, 'piezas_asignadas' => $asignadas]);
            }
        }

        return $workOrderDept;
    }

    // ─── DEPARTMENT MANAGEMENT ───

    public function addDepartment(Request $request, WorkOrder $workOrder): JsonResponse
    {
        $validated = $request->validate([
            'department_slug' => 'required|string|exists:departments,slug',
            'department_phases' => 'nullable|array',
            'department_phases.*' => 'string',
            'department_workers' => 'nullable|array',
            'department_workers.*' => 'integer|exists:users,id',
            'piezas' => 'nullable|integer|min:0',
        ]);

        $slug = $validated['department_slug'];

        if ($workOrder->departments()->whereHas('department', fn ($q) => $q->where('slug', $slug))->exists()) {
            return response()->json(['message' => 'Este departamento ya está activo en la orden.'], 422);
        }

        $allValidated = array_merge($validated, [
            'departments' => [$slug],
            'department_phases' => isset($validated['department_phases']) ? [$slug => $validated['department_phases']] : null,
            'department_piezas' => isset($validated['piezas']) ? [$slug => $validated['piezas']] : null,
            'department_workers' => isset($validated['department_workers']) ? [$slug => $validated['department_workers']] : null,
        ]);

        $this->activateDepartment($workOrder, $slug, $allValidated);
        $workOrder->load($this->orderWith());

        return response()->json(['message' => 'Departamento añadido', 'work_order' => $workOrder]);
    }

    public function addWorkersToDepartment(Request $request, WorkOrder $workOrder): JsonResponse
    {
        $validated = $request->validate([
            'department_id' => 'required|integer|exists:departments,id',
            'user_ids' => 'required|array|min:1',
            'user_ids.*' => 'integer|exists:users,id',
        ]);

        /** @var WorkOrderDepartment $workOrderDept */
        $workOrderDept = $workOrder->departments()
            ->where('department_id', $validated['department_id'])
            ->firstOrFail();

        if ($workOrderDept->isFinalizado()) {
            return response()->json(['message' => 'Este departamento ya está finalizado.'], 422);
        }

        foreach ($validated['user_ids'] as $uid) {
            $workOrderDept->workers()->firstOrCreate(['user_id' => $uid]);
        }

        $workOrder->load($this->orderWith());

        return response()->json(['message' => 'Trabajadores añadidos', 'work_order' => $workOrder]);
    }

    public function removeDepartment(Request $request, WorkOrder $workOrder, WorkOrderDepartment $dept): JsonResponse
    {
        if ($dept->work_order_id !== $workOrder->id) {
            return response()->json(['message' => 'Departamento no pertenece a esta orden.'], 422);
        }

        if ($dept->workSessions()->exists()) {
            return response()->json(['message' => 'No se puede eliminar: el departamento tiene sesiones registradas.'], 422);
        }

        $dept->phases()->delete();
        $dept->workers()->delete();
        $dept->delete();

        $workOrder->load($this->orderWith());

        return response()->json(['message' => 'Departamento eliminado', 'work_order' => $workOrder]);
    }

    public function setWorkerPiezas(Request $request, WorkOrder $workOrder, WorkOrderDepartment $dept, WorkOrderDepartmentWorker $worker): JsonResponse
    {
        $validated = $request->validate([
            'piezas_asignadas' => 'required|integer|min:0',
        ]);

        if ($dept->work_order_id !== $workOrder->id || $worker->work_order_department_id !== $dept->id) {
            return response()->json(['message' => 'Recurso no pertenece a esta orden.'], 422);
        }

        $worker->update(['piezas_asignadas' => $validated['piezas_asignadas']]);
        $workOrder->load($this->orderWith());

        return response()->json(['message' => 'Piezas asignadas', 'work_order' => $workOrder]);
    }

    public function updateDeptPhases(Request $request, WorkOrder $workOrder, WorkOrderDepartment $dept): JsonResponse
    {
        $validated = $request->validate([
            'phase_slugs' => 'required|array',
            'phase_slugs.*' => 'string',
            'piezas' => 'nullable|integer|min:0',
        ]);

        if ($dept->work_order_id !== $workOrder->id) {
            return response()->json(['message' => 'Departamento no pertenece a esta orden.'], 422);
        }

        /** @var \App\Models\Department $department */
        $department = $dept->department()->with('phases')->first();
        $availablePhases = $department->phases->keyBy('slug');

        $dept->phases()->delete();
        foreach ($validated['phase_slugs'] as $slug) {
            if ($phase = $availablePhases->get($slug)) {
                $dept->phases()->create(['phase_id' => $phase->id, 'is_active' => true]);
            }
        }

        if (array_key_exists('piezas', $validated)) {
            $dept->update(['piezas' => $validated['piezas']]);
        }

        $workOrder->load($this->orderWith());

        return response()->json(['message' => 'Fases actualizadas', 'work_order' => $workOrder]);
    }

    public function removeWorkerFromDepartment(Request $request, WorkOrder $workOrder): JsonResponse
    {
        $validated = $request->validate([
            'department_id' => 'required|integer|exists:departments,id',
            'user_id' => 'required|integer|exists:users,id',
        ]);

        /** @var WorkOrderDepartment $workOrderDept */
        $workOrderDept = $workOrder->departments()
            ->where('department_id', $validated['department_id'])
            ->firstOrFail();

        // Close open sessions for this user in this department
        WorkSession::where('work_order_department_id', $workOrderDept->id)
            ->where('user_id', $validated['user_id'])
            ->whereNull('end_time')
            ->update(['end_time' => now()]);

        $workOrderDept->workers()->where('user_id', $validated['user_id'])->delete();

        return response()->json(['message' => 'Trabajador eliminado del departamento']);
    }

    public function finalizeDepartment(Request $request, WorkOrder $workOrder): JsonResponse
    {
        $validated = $request->validate([
            'department_id' => 'required|integer|exists:departments,id',
        ]);

        /** @var WorkOrderDepartment $workOrderDept */
        $workOrderDept = $workOrder->departments()
            ->where('department_id', $validated['department_id'])
            ->firstOrFail();

        if ($workOrderDept->isFinalizado()) {
            return response()->json(['message' => 'Ya estaba finalizado.'], 422);
        }

        DB::transaction(function () use ($workOrderDept) {
            $workOrderDept->update(['finalizado_at' => now()]);
            WorkSession::where('work_order_department_id', $workOrderDept->id)
                ->whereNull('end_time')
                ->update(['end_time' => now()]);
        });

        $workOrder->load($this->orderWith());
        $this->broadcastChange('finalized', $workOrder->id);

        return response()->json(['message' => 'Departamento finalizado', 'work_order' => $workOrder]);
    }

    public function assignPieces(Request $request, WorkOrder $workOrder): JsonResponse
    {
        $validated = $request->validate([
            'work_order_department_id' => 'required|integer|exists:work_order_departments,id',
            'work_order_phase_id' => 'required|integer|exists:work_order_phases,id',
            'user_id' => 'required|integer|exists:users,id',
            'piezas_asignadas' => 'required|integer|min:0',
        ]);

        $deptWorker = WorkOrderDepartmentWorker::where('work_order_department_id', $validated['work_order_department_id'])
            ->where('user_id', $validated['user_id'])
            ->firstOrFail();

        return response()->json(['message' => 'Piezas asignadas']);
    }

    // ─── SESSIONS ───

    private function resolveTargetUser(Request $request): array
    {
        $authUser = $request->user();
        $onBehalfOf = $request->input('on_behalf_of');

        if ($onBehalfOf && in_array($authUser->role, ['admin', 'supervisor'])) {
            $target = User::find($onBehalfOf);
            if (! $target) {
                return [null, response()->json(['message' => 'Trabajador no encontrado.'], 404)];
            }

            return [$target, null];
        }

        return [$authUser, null];
    }

    /**
     * Cap piezas a las restantes según cuota asignada. Devuelve [piezasCap, error].
     */
    private function capPiezasToQuota(int $userId, int $workOrderId, int $deptId, int $requested): array
    {
        $worker = \App\Models\WorkOrderDepartmentWorker::where('work_order_department_id', $deptId)
            ->where('user_id', $userId)->first();
        if (! $worker) return [$requested, null];
        $hechas = (int) WorkSession::where('user_id', $userId)
            ->where('work_order_department_id', $deptId)
            ->whereNotNull('end_time')->sum('piezas');
        $cuota = (int) $worker->piezas_asignadas;
        $restantes = max(0, $cuota - $hechas);
        if ($requested > $restantes && $cuota > 0) {
            return [0, response()->json([
                'message' => "Solo te quedan {$restantes} piezas de tu cuota ({$cuota}).",
            ], 422)];
        }
        return [$requested, null];
    }

    private function sanitizeNotas(?string $notas): ?string
    {
        if ($notas === null) return null;
        return trim(strip_tags($notas));
    }

    public function startSession(Request $request, WorkOrder $workOrder): JsonResponse
    {
        $validated = $request->validate([
            'work_order_department_id' => 'required|integer|exists:work_order_departments,id',
            'work_order_phase_id' => 'required|integer|exists:work_order_phases,id',
            'on_behalf_of' => 'nullable|integer|exists:users,id',
        ]);

        [$target, $errorResponse] = $this->resolveTargetUser($request);
        if ($errorResponse) {
            return $errorResponse;
        }

        $workOrderDept = WorkOrderDepartment::where('id', $validated['work_order_department_id'])
            ->where('work_order_id', $workOrder->id)
            ->firstOrFail();

        if ($workOrderDept->isFinalizado()) {
            return response()->json(['message' => 'Este departamento está finalizado.'], 422);
        }

        $phaseExists = $workOrderDept->phases()
            ->where('id', $validated['work_order_phase_id'])
            ->where('is_active', true)
            ->exists();

        if (! $phaseExists) {
            return response()->json(['message' => 'La fase seleccionada no pertenece a este departamento o no está activa.'], 422);
        }

        // SEGURIDAD: el trabajador debe estar asignado a este departamento
        $isAssigned = $workOrderDept->workers()->where('user_id', $target->id)->exists();
        if (! $isAssigned && $target->role === 'trabajador') {
            return response()->json(['message' => 'No estás asignado a este departamento.'], 403);
        }
        // Admin/supervisor pueden auto-asignarse al iniciar
        if (! $isAssigned) {
            $workOrderDept->workers()->create(['user_id' => $target->id, 'piezas_asignadas' => 0]);
        }

        // SEGURIDAD: prevenir sesión concurrente en la misma orden
        $alreadyActive = WorkSession::where('user_id', $target->id)
            ->where('work_order_id', $workOrder->id)
            ->whereNull('end_time')
            ->exists();
        if ($alreadyActive) {
            return response()->json(['message' => 'Ya tienes una sesión activa en esta orden.'], 409);
        }

        // Cerrar cualquier sesión abierta del usuario en OTRAS órdenes
        WorkSession::where('user_id', $target->id)->whereNull('end_time')->update(['end_time' => now()]);

        $session = WorkSession::create([
            'user_id' => $target->id,
            'work_order_id' => $workOrder->id,
            'work_order_department_id' => $workOrderDept->id,
            'work_order_phase_id' => $validated['work_order_phase_id'],
            'start_time' => now(),
        ]);

        return response()->json(['message' => 'Sesión iniciada', 'session' => $session]);
    }

    public function pauseSession(Request $request, WorkOrder $workOrder): JsonResponse
    {
        $validated = $request->validate([
            'piezas' => 'nullable|integer|min:0',
            'on_behalf_of' => 'nullable|integer|exists:users,id',
            'notas' => 'nullable|string|max:1000',
        ]);

        [$target, $errorResponse] = $this->resolveTargetUser($request);
        if ($errorResponse) {
            return $errorResponse;
        }

        $session = WorkSession::where('work_order_id', $workOrder->id)
            ->where('user_id', $target->id)
            ->whereNull('end_time')
            ->first();

        if (! $session) {
            return response()->json(['message' => 'No hay sesión activa.'], 422);
        }

        $piezasReq = (int) ($validated['piezas'] ?? 0);
        if ($piezasReq > 0 && $session->work_order_department_id) {
            [$piezasReq, $err] = $this->capPiezasToQuota($target->id, $workOrder->id, $session->work_order_department_id, $piezasReq);
            if ($err) return $err;
        }

        $session->update([
            'end_time' => now(),
            'piezas' => $piezasReq,
            'notas' => $this->sanitizeNotas($validated['notas'] ?? null),
        ]);

        return response()->json(['message' => 'Sesión pausada', 'session' => $session]);
    }

    public function stopSession(Request $request, WorkOrder $workOrder): JsonResponse
    {
        $validated = $request->validate([
            'piezas' => 'required|integer|min:0',
            'on_behalf_of' => 'nullable|integer|exists:users,id',
            'notas' => 'nullable|string|max:1000',
        ]);

        [$target, $errorResponse] = $this->resolveTargetUser($request);
        if ($errorResponse) {
            return $errorResponse;
        }

        $session = WorkSession::where('work_order_id', $workOrder->id)
            ->where('user_id', $target->id)
            ->whereNull('end_time')
            ->first();

        if (! $session) {
            return response()->json(['message' => 'No hay sesión activa para esta orden.'], 422);
        }

        $piezasReq = (int) $validated['piezas'];
        if ($piezasReq > 0 && $session->work_order_department_id) {
            [$piezasReq, $err] = $this->capPiezasToQuota($target->id, $workOrder->id, $session->work_order_department_id, $piezasReq);
            if ($err) return $err;
        }

        $session->update([
            'end_time' => now(),
            'piezas' => $piezasReq,
            'notas' => $this->sanitizeNotas($validated['notas'] ?? null),
        ]);

        if ($session->work_order_phase_id && $piezasReq > 0) {
            $this->recordPieces($session, $target->id, $piezasReq);
        }

        try {
            $this->maybeNotifySupervisorOnCompletion($workOrder->id, $session->work_order_department_id, $target->id);
        } catch (\Throwable $e) {
            \Log::warning('Fallo notificando supervisor de cuota completa: ' . $e->getMessage());
        }

        $workOrder->load($this->orderWith());
        $this->broadcastChange('session', $workOrder->id, ['type' => 'stop', 'user_id' => $target->id]);

        return response()->json([
            'message' => 'Sesión finalizada',
            'session' => $session,
            'work_order' => $workOrder,
        ]);
    }

    private function maybeNotifySupervisorOnCompletion(int $workOrderId, ?int $deptId, int $workerId): void
    {
        if (! $deptId) return;

        $worker = WorkOrderDepartmentWorker::where('work_order_department_id', $deptId)
            ->where('user_id', $workerId)->first();
        if (! $worker || $worker->approved_at) return;

        $cuota = (int) $worker->piezas_asignadas;
        if ($cuota <= 0) return;

        $hechas = (int) $worker->piezas_completadas; // accessor
        if ($hechas < $cuota) return;

        $dept = WorkOrderDepartment::with(['department', 'workOrder'])->find($deptId);
        if (! $dept) return;

        $deptSlug = $dept->department?->slug;          // taller / instalacion
        $deptName = $dept->department?->name;          // Taller / Instalación
        $orderCode = $dept->workOrder?->codigo_orden;
        $orderName = $dept->workOrder?->nombre_orden;
        $workerUser = User::find($workerId);
        if (! $workerUser) return;

        // Supervisores cuyo departamento global encaja con el slug
        $matchValues = match ($deptSlug) {
            'taller'      => ['Taller'],
            'instalacion' => ['Instalacion', 'Instalación'],
            default       => [],
        };
        if (empty($matchValues)) return;

        $supervisors = User::where('role', 'supervisor')
            ->whereIn('departamento', $matchValues)
            ->get();
        if ($supervisors->isEmpty()) return;

        foreach ($supervisors as $sup) {
            // Evitar duplicados pendientes
            $exists = Notification::where('user_id', $sup->id)
                ->where('type', 'worker_completion_approval')
                ->whereNull('acted_at')
                ->where('data->work_order_department_worker_id', $worker->id)
                ->exists();
            if ($exists) continue;

            Notification::create([
                'user_id' => $sup->id,
                'type' => 'worker_completion_approval',
                'title' => "{$workerUser->name} ha completado su cuota",
                'body'  => "{$orderCode} · {$deptName} · {$cuota} piezas",
                'link'  => "/supervisor/ordenes/ver/{$workOrderId}",
                'data'  => [
                    'work_order_department_worker_id' => $worker->id,
                    'work_order_id' => $workOrderId,
                    'work_order_department_id' => $deptId,
                    'worker_user_id' => $workerId,
                    'worker_name' => $workerUser->name,
                    'codigo_orden' => $orderCode,
                    'nombre_orden' => $orderName,
                    'departamento' => $deptName,
                    'piezas' => $cuota,
                ],
            ]);
        }
    }

    private function parseSessionDateTime(string $date, string $time): string
    {
        $format = strlen($time) === 8 ? 'Y-m-d H:i:s' : 'Y-m-d H:i';

        return Carbon::createFromFormat($format, "$date $time")->toDateTimeString();
    }

    private function recordPieces(WorkSession $session, int $userId, int $piezas): void
    {
        $deptWorker = WorkOrderDepartmentWorker::where('work_order_department_id', $session->work_order_department_id)
            ->where('user_id', $userId)
            ->first();

        if (! $deptWorker) {
            return;
        }

    }

    public function manualSession(Request $request, WorkOrder $workOrder): JsonResponse
    {
        $validated = $request->validate([
            'fecha' => 'required|date_format:Y-m-d|before_or_equal:today|after_or_equal:' . now()->subDays(30)->toDateString(),
            'hora_inicio' => 'required|date_format:H:i,H:i:s',
            'hora_fin' => 'required|date_format:H:i,H:i:s',
            'piezas' => 'required|integer|min:0',
            'work_order_department_id' => 'nullable|integer|exists:work_order_departments,id',
            'work_order_phase_id' => 'nullable|integer|exists:work_order_phases,id',
            'notas' => 'nullable|string|max:1000',
        ]);

        $user = $request->user();
        $startTime = $this->parseSessionDateTime($validated['fecha'], $validated['hora_inicio']);
        $endTime = $this->parseSessionDateTime($validated['fecha'], $validated['hora_fin']);

        if ($endTime <= $startTime) {
            return response()->json(['message' => 'La hora de fin debe ser posterior a la de inicio.'], 422);
        }

        // SEGURIDAD: el trabajador debe estar asignado a la orden
        if ($user->role === 'trabajador') {
            $isAssigned = $workOrder->departments()
                ->whereHas('workers', fn ($q) => $q->where('user_id', $user->id))
                ->exists();
            if (! $isAssigned) {
                return response()->json(['message' => 'No estás asignado a esta orden.'], 403);
            }
        }

        if (! empty($validated['work_order_department_id'])) {
            $dept = WorkOrderDepartment::find($validated['work_order_department_id']);
            if ($dept) {
                $isInDept = $dept->workers()->where('user_id', $user->id)->exists();
                if (! $isInDept && $user->role === 'trabajador') {
                    return response()->json(['message' => 'No estás asignado a este departamento.'], 403);
                }
                if (! $isInDept) {
                    $dept->workers()->create(['user_id' => $user->id, 'piezas_asignadas' => 0]);
                }
            }
        }

        // Cap piezas a cuota restante
        $piezasReq = (int) $validated['piezas'];
        if ($piezasReq > 0 && ! empty($validated['work_order_department_id'])) {
            [$piezasReq, $err] = $this->capPiezasToQuota($user->id, $workOrder->id, $validated['work_order_department_id'], $piezasReq);
            if ($err) return $err;
        }

        $session = WorkSession::create([
            'user_id' => $user->id,
            'work_order_id' => $workOrder->id,
            'work_order_department_id' => $validated['work_order_department_id'] ?? null,
            'work_order_phase_id' => $validated['work_order_phase_id'] ?? null,
            'start_time' => $startTime,
            'end_time' => $endTime,
            'piezas' => $piezasReq,
            'notas' => $this->sanitizeNotas($validated['notas'] ?? null),
        ]);

        if ($session->work_order_phase_id && $piezasReq > 0) {
            $this->recordPieces($session, $user->id, $piezasReq);
        }

        return response()->json(['message' => 'Sesión registrada manualmente.', 'session' => $session], 201);
    }

    public function updateSession(Request $request, WorkSession $session): JsonResponse
    {
        $user = $request->user();

        if ($session->user_id !== $user->id && ! in_array($user->role, ['admin', 'supervisor'])) {
            return response()->json(['message' => 'No autorizado.'], 403);
        }

        $validated = $request->validate([
            'hora_inicio' => 'required|date_format:H:i,H:i:s',
            'hora_fin' => 'required|date_format:H:i,H:i:s',
            'piezas' => 'required|integer|min:0',
            'notas' => 'nullable|string|max:1000',
        ]);

        $date = Carbon::parse($session->start_time)->format('Y-m-d');
        $newStart = $this->parseSessionDateTime($date, $validated['hora_inicio']);
        $newEnd = $this->parseSessionDateTime($date, $validated['hora_fin']);

        if ($newEnd <= $newStart) {
            return response()->json(['message' => 'La hora de fin debe ser posterior a la de inicio.'], 422);
        }

        $changes = [];
        $oldStart = Carbon::parse($session->start_time)->format('H:i:s');
        $oldEnd = $session->end_time ? Carbon::parse($session->end_time)->format('H:i:s') : null;
        $inputStart = Carbon::parse($newStart)->format('H:i:s');
        $inputEnd = Carbon::parse($newEnd)->format('H:i:s');

        if ($oldStart !== $inputStart) {
            $changes['hora_inicio'] = ['from' => $oldStart, 'to' => $inputStart];
        }
        if ($oldEnd !== $inputEnd) {
            $changes['hora_fin'] = ['from' => $oldEnd,   'to' => $inputEnd];
        }
        if ((int) ($session->piezas ?? 0) !== (int) $validated['piezas']) {
            $changes['piezas'] = ['from' => (int) ($session->piezas ?? 0), 'to' => (int) $validated['piezas']];
        }

        $oldPiezas = (int) ($session->piezas ?? 0);

        $session->update([
            'start_time' => $newStart,
            'end_time' => $newEnd,
            'piezas' => $validated['piezas'],
            'notas' => $validated['notas'] ?? $session->notas,
        ]);

        if (! empty($changes)) {
            $session->logs()->create(['modified_by' => $user->id, 'changes' => $changes]);
        }

        $newPiezas = (int) $validated['piezas'];
        $delta = $newPiezas - $oldPiezas;

        if ($delta !== 0 && $session->work_order_phase_id && $session->work_order_department_id) {
            $deptWorker = WorkOrderDepartmentWorker::where('work_order_department_id', $session->work_order_department_id)
                ->where('user_id', $session->user_id)
                ->first();

        }

        return response()->json(['message' => 'Sesión actualizada.', 'session' => $session]);
    }

    // ─── GENERIC SESSIONS ───

    public function startGenericSession(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'keyword' => 'required|string|max:100',
        ]);

        $user = $request->user();
        $keyword = $validated['keyword'];

        $workOrder = WorkOrder::where('codigo_orden', 'like', 'GEN-%')
            ->where(function ($q) use ($keyword) {
                $q->where('codigo_orden', 'like', '%'.$keyword.'%')
                    ->orWhere('nombre_orden', 'like', '%'.$keyword.'%');
            })
            ->first();

        if (! $workOrder) {
            $workOrder = WorkOrder::create([
                'codigo_orden' => 'GEN-'.strtoupper($keyword),
                'nombre_orden' => ucfirst($keyword),
                'fecha_inicio' => now(),
            ]);
        }

        WorkSession::where('user_id', $user->id)->whereNull('end_time')->update(['end_time' => now()]);

        $session = WorkSession::create([
            'user_id' => $user->id,
            'work_order_id' => $workOrder->id,
            'start_time' => now(),
        ]);

        $workOrder->load($this->orderWith());

        return response()->json([
            'message' => 'Sesión genérica iniciada',
            'session' => $session,
            'work_order' => $workOrder,
        ]);
    }
}
