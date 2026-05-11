<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('work_orders', function (Blueprint $table) {
            $table->id();
            $table->string('codigo_orden')->unique();
            $table->string('nombre_orden');
            $table->date('fecha_inicio')->nullable();
            $table->date('fecha_fin')->nullable();
            $table->unsignedInteger('unidades')->default(1);
            $table->string('nombre_cliente')->nullable();
            $table->string('modelo')->nullable();
            $table->text('observacion')->nullable();
            $table->string('imagen')->nullable();
            $table->timestamps();
        });

        Schema::create('departments', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('slug')->unique();
            $table->timestamps();
        });

        Schema::create('phases', function (Blueprint $table) {
            $table->id();
            $table->foreignId('department_id')->constrained()->cascadeOnDelete();
            $table->string('name');
            $table->string('slug');
            $table->unsignedInteger('order')->default(0);
            $table->boolean('is_optional')->default(false);
            $table->timestamps();
        });

        Schema::create('work_order_departments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('work_order_id')->constrained()->cascadeOnDelete();
            $table->foreignId('department_id')->constrained()->cascadeOnDelete();
            $table->timestamp('finalizado_at')->nullable();
            $table->timestamps();
        });

        Schema::create('work_order_phases', function (Blueprint $table) {
            $table->id();
            $table->foreignId('work_order_department_id')->constrained()->cascadeOnDelete();
            $table->foreignId('phase_id')->constrained()->cascadeOnDelete();
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        Schema::create('work_order_department_workers', function (Blueprint $table) {
            $table->id();
            $table->foreignId('work_order_department_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->unsignedInteger('piezas_asignadas')->default(0);
            $table->timestamps();
            $table->unique(['work_order_department_id', 'user_id'], 'wod_workers_unique');
        });

        Schema::create('work_sessions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('work_order_id')->constrained()->cascadeOnDelete();
            $table->foreignId('work_order_department_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('work_order_phase_id')->nullable()->constrained()->nullOnDelete();
            $table->timestamp('start_time')->nullable();
            $table->timestamp('end_time')->nullable();
            $table->unsignedInteger('piezas')->default(0);
            $table->text('notas')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('work_sessions');
        Schema::dropIfExists('work_order_department_workers');
        Schema::dropIfExists('work_order_phases');
        Schema::dropIfExists('work_order_departments');
        Schema::dropIfExists('phases');
        Schema::dropIfExists('departments');
        Schema::dropIfExists('work_orders');
    }
};
