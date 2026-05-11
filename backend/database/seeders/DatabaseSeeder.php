<?php

namespace Database\Seeders;

use App\Models\Department;
use App\Models\Phase;
use App\Models\Pieza;
use App\Models\User;
use App\Models\WorkOrder;
use App\Models\WorkOrderDepartment;
use App\Models\WorkSession;
use App\Models\Notification;
use App\Models\AuditLog;
use App\Models\Comment;
use Carbon\Carbon;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        // Departments + phases
        $taller = Department::create(['name' => 'Taller', 'slug' => 'taller']);
        foreach ([
            ['Cortar', 'cortar', 1, false],
            ['Doblar', 'doblar', 2, false],
            ['Soldar', 'soldar', 3, false],
            ['Pintar', 'pintar', 4, true],
        ] as [$name, $slug, $order, $pieces]) {
            Phase::create(['department_id' => $taller->id, 'name' => $name, 'slug' => $slug, 'order' => $order, 'pieces_from' => $pieces]);
        }

        $instalacion = Department::create(['name' => 'Instalación', 'slug' => 'instalacion']);
        foreach ([
            ['Preparar material', 'preparar_material', 1, false],
            ['Instalación', 'instalacion', 2, true],
        ] as [$name, $slug, $order, $pieces]) {
            Phase::create(['department_id' => $instalacion->id, 'name' => $name, 'slug' => $slug, 'order' => $order, 'pieces_from' => $pieces]);
        }

        // Users
        User::create(['name' => 'Administrador', 'email' => 'admin@admin.com', 'password' => bcrypt('admin123'), 'role' => 'admin']);
        User::create(['name' => 'Carlos Supervisor', 'email' => 'carlos@supervisor.com', 'password' => bcrypt('admin123'), 'role' => 'supervisor', 'departamento' => 'Taller']);
        User::create(['name' => 'Ana Supervisora', 'email' => 'ana@supervisor.com', 'password' => bcrypt('admin123'), 'role' => 'supervisor', 'departamento' => 'Instalacion']);
        $maria = User::create(['name' => 'María Trabajadora', 'email' => 'maria@trabajador.com', 'password' => bcrypt('admin123'), 'role' => 'trabajador']);
        $luis = User::create(['name' => 'Luis Trabajador', 'email' => 'luis@trabajador.com', 'password' => bcrypt('admin123'), 'role' => 'trabajador']);
        $marcos = User::create(['name' => 'Marcos Trabajador', 'email' => 'marcos@trabajador.com', 'password' => bcrypt('admin123'), 'role' => 'trabajador']);

        // Piezas (catálogo)
        $piezas = [];
        foreach ([
            ['P-001', 'Estructura ST-10',  'Estructura metálica básica 10cm'],
            ['P-002', 'Estructura ST-20',  'Estructura metálica reforzada 20cm'],
            ['P-003', 'Marco MA-15',       'Marco de aluminio anodizado 15cm'],
            ['P-004', 'Soporte SP-LED',    'Soporte universal para LED'],
            ['P-005', 'Carcasa CR-1',      'Carcasa estanca IP65'],
            ['P-006', 'Conector CN-5',     'Conector 5 pines blindado'],
            ['P-007', 'Difusor DF-A',      'Difusor opal acrílico'],
            ['P-008', 'Disipador DS-AL',   'Disipador aluminio 80mm'],
        ] as [$cod, $nom, $desc]) {
            $piezas[$cod] = Pieza::create(['codigo' => $cod, 'nombre' => $nom, 'descripcion' => $desc]);
        }

        // Sample orders
        $createOrder = function (string $codigo, string $nombre, string $cliente, string $piezaCode, array $deptSlugs, array $workersByDept) use ($piezas) {
            $order = WorkOrder::create([
                'codigo_orden' => $codigo,
                'nombre_orden' => $nombre,
                'fecha_inicio' => now(),
                'fecha_fin' => now()->addDays(7),
                'unidades' => 5,
                'pieza_id' => $piezas[$piezaCode]->id,
                'nombre_cliente' => $cliente,
            ]);
            foreach ($deptSlugs as $slug) {
                $dept = Department::where('slug', $slug)->first();
                $wod = $order->departments()->create(['department_id' => $dept->id]);
                foreach ($dept->phases as $phase) {
                    $wod->phases()->create(['phase_id' => $phase->id, 'is_active' => true]);
                }
                $workerIds = $workersByDept[$slug] ?? [];
                $n = count($workerIds);
                $base = $n > 0 ? intdiv($order->unidades, $n) : 0;
                $resto = $n > 0 ? $order->unidades % $n : 0;
                foreach ($workerIds as $wIdx => $uid) {
                    $wod->workers()->create([
                        'user_id' => $uid,
                        'piezas_asignadas' => $base + ($wIdx < $resto ? 1 : 0),
                    ]);
                }
            }
        };

        $createOrder('V26-0001', 'Orden Taller 1',      'Constructora Norte', 'P-001', ['taller'], ['taller' => [$maria->id, $luis->id]]);
        $createOrder('V26-0002', 'Orden Instalación 1', 'Hotel Marina',       'P-005', ['instalacion'], ['instalacion' => [$marcos->id]]);
        $createOrder('V26-0003', 'Orden Mixta',         'Comercial López',    'P-003', ['taller', 'instalacion'], ['taller' => [$maria->id], 'instalacion' => [$marcos->id]]);

        // ─── Generar más órdenes históricas + sesiones para que los gráficos tengan datos ───
        $clientes = ['Edificios Mediterráneo', 'Restaurante La Plaza', 'Centro Comercial Sur', 'Aeropuerto Norte',
                     'Hospital San Juan', 'Hotel Vista Mar', 'Naves Industriales SA', 'Polideportivo Municipal',
                     'Oficinas TechHub', 'Residencial Las Acacias', 'Bodega del Valle', 'Fábrica Textil Norte'];
        $piezaCodes = array_keys($piezas);
        $trabajadores = [$maria, $luis, $marcos];
        $deptCombos = [['taller'], ['instalacion'], ['taller', 'instalacion']];
        $prioridades = ['baja', 'media', 'alta'];

        // 12 órdenes adicionales históricas
        for ($i = 4; $i <= 15; $i++) {
            $codigo = sprintf('V26-%04d', $i);
            $tipo = $deptCombos[($i - 1) % 3];
            $piezaCode = $piezaCodes[($i - 1) % count($piezaCodes)];
            $cliente = $clientes[($i - 1) % count($clientes)];
            $daysAgo = rand(2, 28);
            $duration = rand(5, 14);

            $order = WorkOrder::create([
                'codigo_orden' => $codigo,
                'nombre_orden' => "Pedido {$cliente}",
                'fecha_inicio' => now()->subDays($daysAgo),
                'fecha_fin' => now()->subDays($daysAgo)->addDays($duration),
                'unidades' => rand(3, 25),
                'pieza_id' => $piezas[$piezaCode]->id,
                'prioridad' => $prioridades[array_rand($prioridades)],
                'nombre_cliente' => $cliente,
                'qr_codigo' => url("/admin/ordenes/ver/{$i}"),
            ]);

            $workerIds = collect($trabajadores)->random(rand(1, 2))->pluck('id')->toArray();
            $workersByDept = [];
            foreach ($tipo as $slug) {
                $workersByDept[$slug] = $workerIds;
                $dept = Department::where('slug', $slug)->first();
                $wod = $order->departments()->create(['department_id' => $dept->id]);
                foreach ($dept->phases as $phase) {
                    $wod->phases()->create(['phase_id' => $phase->id, 'is_active' => true]);
                }
                $n = count($workerIds);
                $base = $n > 0 ? intdiv($order->unidades, $n) : 0;
                $resto = $n > 0 ? $order->unidades % $n : 0;
                foreach ($workerIds as $wIdx => $uid) {
                    $wod->workers()->create([
                        'user_id' => $uid,
                        'piezas_asignadas' => $base + ($wIdx < $resto ? 1 : 0),
                    ]);
                }
            }
        }

        // ─── WORK SESSIONS distribuidas en los últimos 30 días (sin pasarse de la cuota) ───
        $allOrders = WorkOrder::with('departments.workers', 'departments.phases.phase')->get();
        $now = Carbon::now();
        // Tracking de piezas ya acumuladas por (orden_id, user_id) para no superar la cuota
        $piezasUsadas = [];

        for ($daysAgo = 0; $daysAgo < 30; $daysAgo++) {
            $date = $now->copy()->subDays($daysAgo);
            if ($date->isSunday()) continue;
            if ($date->isSaturday() && rand(0, 1)) continue;

            $sessionsToday = rand(2, 6);
            for ($s = 0; $s < $sessionsToday; $s++) {
                $worker = $trabajadores[array_rand($trabajadores)];
                $order = $allOrders->random();
                // Buscar el departamento donde está asignado este worker
                $wod = $order->departments->first(fn ($d) => $d->workers->contains('user_id', $worker->id));
                if (!$wod) continue;
                $workerEntry = $wod->workers->firstWhere('user_id', $worker->id);
                $cuota = (int) ($workerEntry?->piezas_asignadas ?? 0);

                $key = $order->id . ':' . $worker->id;
                $usadas = $piezasUsadas[$key] ?? 0;
                $restantes = max(0, $cuota - $usadas);

                // Fase final (la que cuenta piezas)
                $finalPhase = $wod->phases->first(fn ($p) => $p->phase?->pieces_from === true);
                // Si la sesión es en fase final, registra 0-restantes piezas; si no, siempre 0
                $piezasSession = ($finalPhase && $restantes > 0) ? rand(0, min(3, $restantes)) : 0;
                $phaseId = $finalPhase?->id ?? $wod->phases->first()?->id;

                $startHour = rand(8, 17);
                $startMin = rand(0, 59);
                $durationMins = rand(20, 180);
                $start = $date->copy()->setTime($startHour, $startMin, 0);
                $end = $start->copy()->addMinutes($durationMins);

                WorkSession::create([
                    'user_id' => $worker->id,
                    'work_order_id' => $order->id,
                    'work_order_department_id' => $wod->id,
                    'work_order_phase_id' => $phaseId,
                    'start_time' => $start,
                    'end_time' => $end,
                    'piezas' => $piezasSession,
                    'notas' => rand(0, 4) === 0 ? 'Trabajo completado sin incidencias.' : null,
                ]);

                $piezasUsadas[$key] = $usadas + $piezasSession;
            }
        }

        // ─── COMMENTS de ejemplo ───
        $comentarios = [
            'Recibido el material esta mañana, podemos empezar.',
            'Cliente ha solicitado un cambio de color para la próxima entrega.',
            'Verificad que las medidas coincidan con la pieza P-001 antes de cortar.',
            'Falta una unidad por revisar, lo dejo apuntado.',
            'Todo OK por mi parte, lista para instalación.',
        ];
        foreach ($allOrders->take(8) as $i => $order) {
            $userPool = User::all()->all();
            for ($c = 0; $c < rand(1, 3); $c++) {
                $author = $userPool[array_rand($userPool)];
                Comment::create([
                    'work_order_id' => $order->id,
                    'user_id' => $author->id,
                    'body' => $comentarios[array_rand($comentarios)],
                    'created_at' => now()->subDays(rand(0, 10))->subHours(rand(0, 23)),
                    'updated_at' => now()->subDays(rand(0, 10)),
                ]);
            }
        }

        // ─── AUDIT LOGS de ejemplo ───
        foreach ($allOrders->take(10) as $order) {
            AuditLog::create([
                'user_id' => 1,
                'action' => 'created',
                'subject_type' => 'WorkOrder',
                'subject_id' => $order->id,
                'summary' => "Orden {$order->codigo_orden} creada",
                'created_at' => $order->created_at,
            ]);
            if (rand(0, 1)) {
                AuditLog::create([
                    'user_id' => 1,
                    'action' => 'updated',
                    'subject_type' => 'WorkOrder',
                    'subject_id' => $order->id,
                    'summary' => "Prioridad actualizada",
                    'created_at' => $order->created_at->copy()->addDays(rand(1, 5)),
                ]);
            }
        }

        // ─── NOTIFICATIONS para trabajadores ───
        foreach ($trabajadores as $t) {
            for ($n = 0; $n < rand(2, 4); $n++) {
                $order = $allOrders->random();
                Notification::create([
                    'user_id' => $t->id,
                    'title' => "Nueva orden asignada: {$order->codigo_orden}",
                    'body' => $order->nombre_orden,
                    'link' => '/trabajador/ordenes',
                    'read_at' => rand(0, 2) === 0 ? null : now()->subDays(rand(0, 3)),
                    'created_at' => now()->subDays(rand(0, 14)),
                    'updated_at' => now()->subDays(rand(0, 14)),
                ]);
            }
        }
    }
}
