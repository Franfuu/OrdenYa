<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Comment extends Model
{
    protected $fillable = ['work_order_id', 'user_id', 'body'];

    public function user() { return $this->belongsTo(User::class); }
    public function workOrder() { return $this->belongsTo(WorkOrder::class); }
}
