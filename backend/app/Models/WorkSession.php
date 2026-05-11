<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class WorkSession extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'work_order_id',
        'work_order_department_id',
        'work_order_phase_id',
        'start_time',
        'end_time',
        'piezas',
        'notas',
    ];

    protected $appends = ['duration_in_seconds'];

    protected function casts(): array
    {
        return [
            'start_time' => 'datetime',
            'end_time' => 'datetime',
            'piezas' => 'integer',
        ];
    }

    public function workOrder(): BelongsTo
    {
        return $this->belongsTo(WorkOrder::class);
    }

    public function workOrderDepartment(): BelongsTo
    {
        return $this->belongsTo(WorkOrderDepartment::class);
    }

    public function workOrderPhase(): BelongsTo
    {
        return $this->belongsTo(WorkOrderPhase::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    protected function durationInSeconds(): Attribute
    {
        return Attribute::make(
            get: function () {
                if (! $this->start_time) {
                    return null;
                }
                $end = $this->end_time ?? now();

                return $this->start_time->diffInSeconds($end);
            }
        );
    }
}
