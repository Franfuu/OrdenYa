<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Department extends Model
{
    protected $fillable = ['name', 'slug'];

    public function phases()
    {
        return $this->hasMany(Phase::class)->orderBy('order');
    }

    public function workOrderDepartments()
    {
        return $this->hasMany(WorkOrderDepartment::class);
    }
}
