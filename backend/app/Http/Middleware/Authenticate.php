<?php

namespace App\Http\Middleware;

use Illuminate\Auth\Middleware\Authenticate as Middleware;
use Illuminate\Http\Request;

class Authenticate extends Middleware
{
    /**
     * Always return null so unauthenticated API requests get a 401 JSON response
     * instead of a redirect to a named 'login' route (which doesn't exist).
     */
    protected function redirectTo(Request $request): ?string
    {
        return null;
    }
}
