<?php

namespace App\Http\Controllers;

use App\Models\Comment;
use App\Models\WorkOrder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CommentController extends Controller
{
    public function index(WorkOrder $workOrder): JsonResponse
    {
        return response()->json(
            $workOrder->comments()->with('user:id,name,role')->orderBy('created_at', 'desc')->get()
        );
    }

    public function store(Request $request, WorkOrder $workOrder): JsonResponse
    {
        $validated = $request->validate(['body' => 'required|string|max:2000']);
        $comment = Comment::create([
            'work_order_id' => $workOrder->id,
            'user_id' => $request->user()->id,
            'body' => $validated['body'],
        ]);
        $comment->load('user:id,name,role');
        return response()->json($comment, 201);
    }

    public function destroy(Request $request, Comment $comment): JsonResponse
    {
        $user = $request->user();
        if ($comment->user_id !== $user->id && $user->role !== 'admin') {
            return response()->json(['message' => 'Sin permiso'], 403);
        }
        $comment->delete();
        return response()->json(null, 204);
    }
}
