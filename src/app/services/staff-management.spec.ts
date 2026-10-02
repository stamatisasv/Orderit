import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { SupabaseService } from './supabase';
import { StaffManagementService, StaffOrder } from './staff-management';

describe('StaffManagementService', () => {
  function setup() {
    const rpc = vi.fn().mockResolvedValue({ error: null });
    TestBed.configureTestingModule({ providers: [
      StaffManagementService, { provide: SupabaseService, useValue: { client: { rpc } } },
    ] });
    return { service: TestBed.inject(StaffManagementService), rpc };
  }
  it('sends identifiers and quantities, leaving prices and totals to the database', async () => {
    const { service, rpc } = setup();
    await service.saveOrder('order-id', 3, 'No onions', [
      { item_id: 7, name: 'Existing item', price: 0.01, quantity: 2 },
      { product_id: 9, name: 'New item', price: 0.01, quantity: 1 },
    ], '2026-09-30T12:00:00Z');
    expect(rpc).toHaveBeenCalledWith('save_staff_order', {
      p_id: 'order-id', p_table_id: 3, p_notes: 'No onions',
      p_items: [
        { item_id: 7, product_id: undefined, quantity: 2 },
        { item_id: undefined, product_id: 9, quantity: 1 },
      ], p_expected_updated_at: '2026-09-30T12:00:00Z',
    });
  });
  it('passes the version when changing a status to prevent overwriting newer edits', async () => {
    const { service, rpc } = setup();
    const order = { id: 'order-id', updatedAt: 'version' } as StaffOrder;
    await service.setStatus(order, 'served');
    expect(rpc).toHaveBeenCalledWith('set_order_status', {
      p_id: 'order-id', p_status: 'served', p_expected_updated_at: 'version',
    });
  });
  it('propagates database permission and conflict errors', async () => {
    const { service, rpc } = setup();
    rpc.mockResolvedValue({ error: { message: 'Admin access required' } });
    await expect(service.deleteOrder({ id: 'id', updatedAt: 'version' } as StaffOrder))
      .rejects.toEqual({ message: 'Admin access required' });
  });
});
