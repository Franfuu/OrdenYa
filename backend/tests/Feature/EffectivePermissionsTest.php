<?php
namespace Tests\Feature;

use App\Models\FormField;
use App\Models\PermissionTemplate;
use App\Models\PermissionTemplateField;
use App\Models\User;
use App\Models\UserPermissionOverride;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class EffectivePermissionsTest extends TestCase
{
    use RefreshDatabase;

    private function makeField(string $key, int $order = 1): FormField
    {
        return FormField::create([
            'field_key' => $key, 'label' => $key, 'type' => 'text',
            'is_base_field' => true, 'sort_order' => $order,
        ]);
    }

    private function makeSupervisor(): User
    {
        return User::factory()->create(['role' => 'supervisor', 'permission_template_id' => null]);
    }

    public function test_default_permissions_are_all_true(): void
    {
        $this->makeField('codigo_orden');
        $supervisor = $this->makeSupervisor();

        $perms = $supervisor->effectivePermissions();

        $this->assertTrue($perms['codigo_orden']['can_view']);
        $this->assertTrue($perms['codigo_orden']['can_create']);
        $this->assertTrue($perms['codigo_orden']['can_edit']);
        $this->assertEquals('default', $perms['codigo_orden']['source']);
    }

    public function test_template_permission_overrides_default(): void
    {
        $this->makeField('codigo_orden');
        $template = PermissionTemplate::create(['name' => 'T1']);
        PermissionTemplateField::create([
            'template_id' => $template->id, 'field_key' => 'codigo_orden',
            'can_view' => true, 'can_create' => false, 'can_edit' => false,
        ]);
        $supervisor = User::factory()->create(['role' => 'supervisor', 'permission_template_id' => $template->id]);

        $perms = $supervisor->effectivePermissions();

        $this->assertTrue($perms['codigo_orden']['can_view']);
        $this->assertFalse($perms['codigo_orden']['can_create']);
        $this->assertFalse($perms['codigo_orden']['can_edit']);
        $this->assertEquals('template', $perms['codigo_orden']['source']);
    }

    public function test_user_override_takes_precedence_over_template(): void
    {
        $this->makeField('codigo_orden');
        $template = PermissionTemplate::create(['name' => 'T2']);
        PermissionTemplateField::create([
            'template_id' => $template->id, 'field_key' => 'codigo_orden',
            'can_view' => false, 'can_create' => false, 'can_edit' => false,
        ]);
        $supervisor = User::factory()->create(['role' => 'supervisor', 'permission_template_id' => $template->id]);
        UserPermissionOverride::create([
            'user_id' => $supervisor->id, 'field_key' => 'codigo_orden',
            'can_view' => true, 'can_create' => true, 'can_edit' => false,
        ]);

        $perms = $supervisor->effectivePermissions();

        $this->assertTrue($perms['codigo_orden']['can_view']);
        $this->assertTrue($perms['codigo_orden']['can_create']);
        $this->assertFalse($perms['codigo_orden']['can_edit']);
        $this->assertEquals('override', $perms['codigo_orden']['source']);
    }

    public function test_only_fields_in_form_fields_table_are_returned(): void
    {
        $this->makeField('campo_a', 1);
        $this->makeField('campo_b', 2);
        $supervisor = $this->makeSupervisor();

        $perms = $supervisor->effectivePermissions();

        $this->assertArrayHasKey('campo_a', $perms);
        $this->assertArrayHasKey('campo_b', $perms);
        $this->assertCount(2, $perms);
    }

    public function test_api_me_returns_all_true_for_admin(): void
    {
        $this->makeField('codigo_orden');
        $admin = User::factory()->create(['role' => 'admin']);

        $response = $this->actingAs($admin)->getJson('/api/users/me/permissions');

        $response->assertOk();
        $this->assertTrue($response->json('codigo_orden.can_view'));
        $this->assertEquals('admin', $response->json('codigo_orden.source'));
    }

    public function test_api_me_returns_effective_permissions_for_supervisor(): void
    {
        $this->makeField('codigo_orden');
        $template = PermissionTemplate::create(['name' => 'T3']);
        PermissionTemplateField::create([
            'template_id' => $template->id, 'field_key' => 'codigo_orden',
            'can_view' => true, 'can_create' => false, 'can_edit' => false,
        ]);
        $supervisor = User::factory()->create(['role' => 'supervisor', 'permission_template_id' => $template->id]);

        $response = $this->actingAs($supervisor)->getJson('/api/users/me/permissions');

        $response->assertOk();
        $this->assertFalse($response->json('codigo_orden.can_create'));
        $this->assertEquals('template', $response->json('codigo_orden.source'));
    }
}
