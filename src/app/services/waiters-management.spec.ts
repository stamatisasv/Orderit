import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { SupabaseService } from './supabase';
import { Waiter, WaitersManagementService } from './waiters-management';

describe('WaitersManagementService', () => {
  const waiter: Waiter = {
    user_id: 'waiter',
    name: 'Alex',
    email: 'alex@example.com',
    email_confirmed_at: null,
  };
  function setup() {
    const rpc = vi.fn().mockResolvedValue({ data: [waiter], error: null });
    const invoke = vi
      .fn()
      .mockResolvedValue({ data: { message: 'Invitation sent.' }, error: null });
    TestBed.configureTestingModule({
      providers: [
        { provide: SupabaseService, useValue: { client: { rpc, functions: { invoke } } } },
      ],
    });
    return { service: TestBed.inject(WaitersManagementService), rpc, invoke };
  }
  it('invites through the server function with no browser-side admin credentials', async () => {
    const { service, invoke } = setup();
    await service.invite(' alex@example.com ', ' Alex ');
    expect(invoke).toHaveBeenCalledWith('invite-waiter', {
      body: { email: 'alex@example.com', name: 'Alex' },
    });
  });
  it('creates logins through the server and preserves password whitespace', async () => {
    const { service, invoke } = setup();
    await service.create(' alex@example.com ', ' Alex ', ' secret123 ');
    expect(invoke).toHaveBeenCalledWith('create-waiter', {
      body: { email: 'alex@example.com', name: 'Alex', password: ' secret123 ' },
    });
  });
  it('lists waiters and links existing accounts through admin-only functions', async () => {
    const { service, rpc } = setup();
    expect(await service.list()).toEqual([waiter]);
    await service.add(' alex@example.com ', ' Alex ');
    expect(rpc).toHaveBeenCalledWith('add_waiter_by_email', {
      p_email: 'alex@example.com',
      p_name: 'Alex',
    });
  });
  it('passes the previous name to prevent stale changes or access removal', async () => {
    const { service, rpc } = setup();
    await service.rename(waiter, 'Alexandra');
    await service.remove(waiter);
    expect(rpc).toHaveBeenCalledWith('rename_waiter', {
      p_user_id: 'waiter',
      p_name: 'Alexandra',
      p_expected_name: 'Alex',
    });
    expect(rpc).toHaveBeenCalledWith('remove_waiter', {
      p_user_id: 'waiter',
      p_expected_name: 'Alex',
    });
  });
  it('propagates server-side authorization failures', async () => {
    const { service, rpc } = setup();
    rpc.mockResolvedValueOnce({ error: { message: 'Admin access required' } });
    await expect(service.list()).rejects.toEqual({ message: 'Admin access required' });
  });
});
