<?php

namespace App\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class WorkOrdersChanged implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public string $action;   // created | updated | deleted | session | approved
    public ?int $workOrderId;
    public array $meta;

    public function __construct(string $action, ?int $workOrderId = null, array $meta = [])
    {
        $this->action = $action;
        $this->workOrderId = $workOrderId;
        $this->meta = $meta;
    }

    public function broadcastOn(): array
    {
        // Canal público — todos los clientes autenticados escuchan
        return [new Channel('work-orders')];
    }

    public function broadcastAs(): string
    {
        return 'work-orders.changed';
    }

    public function broadcastWith(): array
    {
        return [
            'action' => $this->action,
            'work_order_id' => $this->workOrderId,
            'meta' => $this->meta,
            'at' => now()->toIso8601String(),
        ];
    }
}
