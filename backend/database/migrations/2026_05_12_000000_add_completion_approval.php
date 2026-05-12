<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('notifications', function (Blueprint $table) {
            $table->string('type')->nullable()->after('body');
            $table->json('data')->nullable()->after('type');
            $table->timestamp('acted_at')->nullable()->after('read_at');
        });

        Schema::table('work_order_department_workers', function (Blueprint $table) {
            $table->timestamp('approved_at')->nullable()->after('piezas_asignadas');
            $table->foreignId('approved_by')->nullable()->after('approved_at')
                ->constrained('users')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('work_order_department_workers', function (Blueprint $table) {
            $table->dropConstrainedForeignId('approved_by');
            $table->dropColumn('approved_at');
        });

        Schema::table('notifications', function (Blueprint $table) {
            $table->dropColumn(['type', 'data', 'acted_at']);
        });
    }
};
