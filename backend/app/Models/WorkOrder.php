<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class WorkOrder extends Model
{
    use HasFactory;

    protected $fillable = [
        'codigo_orden',
        'nombre_orden',
        'fecha_inicio',
        'fecha_fin',
        'unidades',
        'pieza_id',
        'prioridad',
        'nombre_cliente',
        'observacion',
        'imagen',
        'qr_codigo',
    ];

    protected function casts(): array
    {
        return [
            'fecha_inicio' => 'date',
            'fecha_fin'    => 'date',
            'unidades'     => 'integer',
        ];
    }

    public function departments(): HasMany
    {
        return $this->hasMany(WorkOrderDepartment::class);
    }

    public function workSessions(): HasMany
    {
        return $this->hasMany(WorkSession::class);
    }

    public function pieza(): BelongsTo
    {
        return $this->belongsTo(Pieza::class);
    }

    public function isFinalizada(): bool
    {
        $activeDepts = $this->departments;
        if ($activeDepts->isEmpty()) return false;
        return $activeDepts->every(fn ($d) => $d->isFinalizado());
    }

    public function getTiempoTotalSegundosAttribute(): int
    {
        return $this->workSessions()->whereNotNull('end_time')->get()->sum(fn ($s) => $s->duration_in_seconds);
    }
}
