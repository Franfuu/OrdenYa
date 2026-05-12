<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class WorkOrderDepartmentWorker extends Model
{
    protected $table = 'work_order_department_workers';
    protected $fillable = ['work_order_department_id', 'user_id', 'piezas_asignadas', 'approved_at', 'approved_by'];
    protected $appends = ['piezas_completadas'];
    protected $casts = ['approved_at' => 'datetime'];

    public function workOrderDepartment() { return $this->belongsTo(WorkOrderDepartment::class); }
    public function user() { return $this->belongsTo(User::class); }

    public function getPiezasCompletadasAttribute(): int
    {
        return (int) WorkSession::where('work_order_department_id', $this->work_order_department_id)
            ->where('user_id', $this->user_id)
            ->whereNotNull('end_time')
            ->sum('piezas');
    }
}
