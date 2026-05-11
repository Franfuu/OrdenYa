<?php

namespace App\Http\Controllers;

use App\Models\Pieza;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;

class PiezaController extends Controller
{
    public function index(): JsonResponse
    {
        return response()->json(Pieza::orderBy('codigo')->get());
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'codigo' => 'required|string|max:255|unique:piezas,codigo',
            'nombre' => 'required|string|max:255',
            'descripcion' => 'nullable|string',
            'foto' => 'nullable|file|image|max:5120',
        ]);

        $data = [
            'codigo' => $validated['codigo'],
            'nombre' => $validated['nombre'],
            'descripcion' => $validated['descripcion'] ?? null,
        ];

        if ($request->hasFile('foto')) {
            $path = $request->file('foto')->store('piezas', 'public');
            $data['foto'] = url(Storage::url($path));
        }

        return response()->json(Pieza::create($data), 201);
    }

    public function show(Pieza $pieza): JsonResponse
    {
        return response()->json($pieza);
    }

    public function update(Request $request, Pieza $pieza): JsonResponse
    {
        $validated = $request->validate([
            'codigo' => ['sometimes', 'required', 'string', 'max:255', Rule::unique('piezas')->ignore($pieza->id)],
            'nombre' => 'sometimes|required|string|max:255',
            'descripcion' => 'nullable|string',
            'foto' => 'nullable|file|image|max:5120',
        ]);

        $data = collect($validated)->except('foto')->toArray();

        if ($request->hasFile('foto')) {
            if ($pieza->foto && str_contains($pieza->foto, '/storage/piezas/')) {
                Storage::disk('public')->delete('piezas/' . basename($pieza->foto));
            }
            $path = $request->file('foto')->store('piezas', 'public');
            $data['foto'] = url(Storage::url($path));
        }

        $pieza->update($data);
        return response()->json($pieza);
    }

    public function destroy(Pieza $pieza): JsonResponse
    {
        $enUso = $pieza->workOrders()->count();
        if ($enUso > 0) {
            return response()->json([
                'message' => "No se puede eliminar: la pieza está en uso por {$enUso} orden" . ($enUso === 1 ? "" : "es") . ".",
            ], 422);
        }
        if ($pieza->foto && str_contains($pieza->foto, '/storage/piezas/')) {
            Storage::disk('public')->delete('piezas/' . basename($pieza->foto));
        }
        $pieza->delete();
        return response()->json(null, 204);
    }
}
