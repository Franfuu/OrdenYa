<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use App\Models\WorkOrder;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('piezas', function (Blueprint $table) {
            $table->string('foto')->nullable()->after('descripcion');
        });
        Schema::table('work_orders', function (Blueprint $table) {
            $table->string('qr_codigo')->nullable()->after('imagen');
        });

        // Auto-populate qr_codigo de órdenes existentes
        foreach (WorkOrder::whereNull('qr_codigo')->get() as $order) {
            $order->qr_codigo = url("/admin/ordenes/ver/{$order->id}");
            $order->save();
        }
    }

    public function down(): void
    {
        Schema::table('piezas', function (Blueprint $table) { $table->dropColumn('foto'); });
        Schema::table('work_orders', function (Blueprint $table) { $table->dropColumn('qr_codigo'); });
    }
};
