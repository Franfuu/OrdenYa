<?php

namespace App\Models;

use App\Events\NotificationCreated;
use Illuminate\Database\Eloquent\Model;

class Notification extends Model
{
    protected $fillable = ['user_id', 'title', 'body', 'link', 'read_at', 'type', 'data', 'acted_at'];
    protected $casts = [
        'read_at' => 'datetime',
        'acted_at' => 'datetime',
        'data' => 'array',
    ];

    protected static function booted(): void
    {
        static::created(function (Notification $notification) {
            try {
                broadcast(new NotificationCreated($notification));
            } catch (\Throwable $e) {
                \Log::warning('Broadcast NotificationCreated falló: ' . $e->getMessage());
            }
        });
    }

    public function user() { return $this->belongsTo(User::class); }
}
