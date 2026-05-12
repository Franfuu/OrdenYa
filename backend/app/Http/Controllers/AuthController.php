<?php
namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cookie;
use Illuminate\Support\Facades\Hash;

class AuthController extends Controller
{
    public function login(Request $request)
    {
        $request->validate([
            'email' => ['required', 'email'],
            'password' => ['required'],
        ]);

        $user = User::where('email', $request->email)->first();

        if (!$user || !Hash::check($request->password, $user->password)) {
            return response()->json([
                'message' => 'Las credenciales no coinciden con nuestros registros.',
            ], 401);
        }

        /** @var \App\Models\User $user */
        $token = $user->createToken('auth_token')->plainTextToken;

        $isProduction = app()->environment('production');

        return response()->json(['user' => $user])
            ->cookie(
                'auth_token',
                $token,
                60 * 24 * 7,
                '/',
                null,
                $isProduction,   // secure: true in production (HTTPS)
                true,            // httpOnly
                false,
                $isProduction ? 'none' : 'lax'  // none required for cross-domain
            );
    }

    public function logout(Request $request)
    {
        /** @var \App\Models\User $user */
        $user = $request->user();
        $user->currentAccessToken()->delete();

        return response()->json(['message' => 'Logged out successfully'])
            ->cookie(Cookie::forget('auth_token'));
    }

    public function me(Request $request)
    {
        return response()->json(['user' => $request->user()]);
    }
}
