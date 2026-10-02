import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { SupabaseService } from './supabase';
import { GuestOrderingService, TableState } from './guest-ordering';

const state: TableState = {
  id: 1, name: 'Table 1', visit_id: 'visit', version: 3,
  basket: [{ product_id: 1, name: 'Coffee', price: 3, quantity: 2, available: true }],
  orders: [], requests: [],
};
describe('GuestOrderingService', () => {
  beforeEach(() => sessionStorage.clear());
  function setup() {
    const rpc = vi.fn().mockResolvedValue({ data: state, error: null });
    TestBed.configureTestingModule({ providers: [GuestOrderingService,
      { provide: SupabaseService, useValue: { client: { rpc } } },
    ] });
    return { guest: TestBed.inject(GuestOrderingService), rpc };
  }
  it('sends an atomic delta rather than overwriting another guest’s quantity', async () => {
    const { guest, rpc } = setup();
    await guest.select('token');
    await guest.change(1, 1);
    expect(rpc).toHaveBeenCalledWith('change_table_basket', expect.objectContaining({
      p_token: 'token', p_visit: 'visit', p_product: 1, p_delta: 1, p_operation: expect.any(String),
    }));
    expect(guest.total()).toBe(6);
  });
  it('reuses the checkout request after an uncertain network response', async () => {
    const { guest, rpc } = setup();
    await guest.select('token');
    rpc.mockImplementation(async (name: string) => name === 'checkout_table_basket'
      ? { error: { message: 'Network error', code: '' } } : { data: state, error: null });
    await guest.checkout('Water please');
    expect(guest.pendingCheckout()).toBe(true);
    await guest.checkout('Water please');
    const calls = rpc.mock.calls.filter(([name]) => name === 'checkout_table_basket');
    expect(calls[0][1].p_request).toBe(calls[1][1].p_request);
    expect(calls[0][1].p_version).toBe(3);
    expect(guest.busy()).toBe(false);
  });
  it('discards a late response after changing tables', async () => {
    const { guest, rpc } = setup();
    let resolveOld!: (value: unknown) => void;
    rpc.mockImplementation((_name: string, args: { p_token: string }) => args.p_token === 'old'
      ? new Promise(resolve => { resolveOld = resolve; })
      : Promise.resolve({ data: { ...state, id: 2, name: 'Table 2' }, error: null }));
    const old = guest.select('old');
    await guest.select('new');
    resolveOld({ data: state, error: null });
    await old;
    expect(guest.state()?.id).toBe(2);
  });
  it('marks retained data stale, blocks actions, and recovers after a failed refresh', async () => {
    const { guest, rpc } = setup();
    await guest.select('token');
    rpc.mockResolvedValueOnce({ data: null, error: { message: 'Network unavailable' } });
    await guest.refresh();
    expect(guest.state()).toEqual(state);
    expect(guest.connected()).toBe(false);
    expect(guest.connectionError()).toBe('Network unavailable');
    rpc.mockClear();
    await guest.change(1, 1);
    await guest.checkout('');
    await guest.help('waiter');
    expect(rpc).not.toHaveBeenCalled();
    await guest.refresh();
    expect(guest.connected()).toBe(true);
    expect(guest.connectionError()).toBe('');
  });
  it('recovers from a rejected network request without leaving a connection error', async () => {
    const { guest, rpc } = setup();
    await guest.select('token');
    rpc.mockRejectedValueOnce(new Error('Offline'));
    await guest.refresh();
    expect(guest.connected()).toBe(false);
    await guest.refresh();
    expect(guest.connected()).toBe(true);
    expect(guest.connectionError()).toBe('');
  });

});
