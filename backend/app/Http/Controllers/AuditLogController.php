<?php

namespace App\Http\Controllers;

use App\Models\AuditLog;
use App\Models\WorkOrder;
use Illuminate\Http\JsonResponse;

class AuditLogController extends Controller
{
    public function forOrder(WorkOrder $workOrder): JsonResponse
    {
        return response()->json(
            AuditLog::where('subject_type', 'WorkOrder')
                ->where('subject_id', $workOrder->id)
                ->with('user:id,name,role')
                ->orderByDesc('created_at')
                ->limit(50)
                ->get()
        );
    }
}
