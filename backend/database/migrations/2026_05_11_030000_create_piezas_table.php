<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('piezas', function (Blueprint $table) {
            $table->id();
            $table->string('codigo')->unique();
            $table->string('nombre');
            $table->text('descripcion')->nullable();
            $table->timestamps();
        });

        Schema::table('work_orders', function (Blueprint $table) {
            $table->foreignId('pieza_id')->nullable()->after('unidades')->constrained('piezas')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('work_orders', function (Blueprint $table) {
            $table->dropForeign(['pieza_id']);
            $table->dropColumn('pieza_id');
        });
        Schema::dropIfExists('piezas');
    }
};
