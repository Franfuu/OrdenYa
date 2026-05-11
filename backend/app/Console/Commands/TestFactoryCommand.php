<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;

class TestFactoryCommand extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'app:test-factory';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Reproduction for factory error';

    /**
     * Execute the console command.
     */
    public function handle()
    {
        try {
            $this->info('Creating user with factory...');
            \App\Models\User::factory()->create();
            $this->info('User created successfully!');
        } catch (\Throwable $e) {
            $this->error('Error caught: '.$e->getMessage());
            $this->info('Stack trace:');
            $this->line($e->getTraceAsString());
        }
    }
}
