<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class AuditLog extends Model
{
    public $timestamps = false;
    protected $fillable = ['user_id', 'action', 'subject_type', 'subject_id', 'summary', 'created_at'];
    protected $casts = ['created_at' => 'datetime'];

    public function user() { return $this->belongsTo(User::class); }

    public static function log(?int $userId, string $action, string $subjectType, ?int $subjectId, ?string $summary = null): void
    {
        self::create([
            'user_id' => $userId,
            'action' => $action,
            'subject_type' => $subjectType,
            'subject_id' => $subjectId,
            'summary' => $summary,
            'created_at' => now(),
        ]);
    }
}
