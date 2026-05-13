<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::table('users')->where('departamento', 'General')->update(['departamento' => null]);
    }

    public function down(): void
    {
    }
};
