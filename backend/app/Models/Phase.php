<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Phase extends Model
{
    protected $fillable = ['department_id', 'name', 'slug', 'order', 'is_optional', 'pieces_from'];
    protected $casts = ['is_optional' => 'boolean', 'pieces_from' => 'boolean', 'order' => 'integer'];

    public function department() { return $this->belongsTo(Department::class); }
    public function workOrderPhases() { return $this->hasMany(WorkOrderPhase::class); }
}
