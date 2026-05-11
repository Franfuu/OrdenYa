<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class WorkOrderDepartment extends Model
{
    protected $fillable = ['work_order_id', 'department_id', 'finalizado_at'];
    protected $casts = ['finalizado_at' => 'datetime'];

    public function workOrder() { return $this->belongsTo(WorkOrder::class); }
    public function department() { return $this->belongsTo(Department::class); }
    public function phases() { return $this->hasMany(WorkOrderPhase::class); }
    public function workers() { return $this->hasMany(WorkOrderDepartmentWorker::class); }
    public function workSessions() { return $this->hasMany(WorkSession::class); }

    public function isFinalizado(): bool { return $this->finalizado_at !== null; }
}
