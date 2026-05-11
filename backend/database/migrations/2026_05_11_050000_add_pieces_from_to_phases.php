<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('phases', function (Blueprint $table) {
            $table->boolean('pieces_from')->default(false)->after('is_optional');
        });

        // Marcar fase final de cada departamento (la que pide piezas)
        DB::table('phases')->where('slug', 'pintar')->update(['pieces_from' => true]);
        DB::table('phases')->where('slug', 'instalacion')->update(['pieces_from' => true]);
        DB::table('phases')->where('slug', 'pruebas')->update(['pieces_from' => true]);
    }

    public function down(): void
    {
        Schema::table('phases', function (Blueprint $table) {
            $table->dropColumn('pieces_from');
        });
    }
};
