<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class WorkOrderPhase extends Model
{
    protected $fillable = [
        'work_order_department_id',
        'phase_id',
        'custom_name',
        'is_active',
    ];

    protected $casts = [
        'is_active' => 'boolean',
    ];

    public function workOrderDepartment()
    {
        return $this->belongsTo(WorkOrderDepartment::class);
    }

    public function phase()
    {
        return $this->belongsTo(Phase::class);
    }

    public function workSessions()
    {
        return $this->hasMany(WorkSession::class, 'work_order_phase_id');
    }

    public function getDisplayNameAttribute(): string
    {
        return $this->custom_name ?? $this->phase?->name ?? '';
    }
}
