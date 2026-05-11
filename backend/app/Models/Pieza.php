<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Pieza extends Model
{
    protected $fillable = ['codigo', 'nombre', 'descripcion', 'foto'];

    public function workOrders(): HasMany
    {
        return $this->hasMany(WorkOrder::class);
    }
}
