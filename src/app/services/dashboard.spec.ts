import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { SupabaseService } from './supabase';
import { DashboardService, ACTIVE_ORDER_STATUSES } from './dashboard';

function query(result: object) {
  const builder: any = {
    then: (resolve: any, reject: any) => Promise.resolve(result).then(resolve, reject),
  };
  for (const method of ['select', 'in', 'order', 'limit'])
    builder[method] = vi.fn().mockReturnValue(builder);
  return builder;
}
describe('DashboardService', () => {
  function setup(failure = false) {
    const products = query({ count: 24, error: null });
    const active = query({ count: 321, error: null });
    const tables = query({
      count: failure ? null : 10,
      error: failure ? { message: 'Permission denied' } : null,
    });
    const recent = query({
      data: [{ id: 'order', status: 'accepted', restaurant_tables: { name: 'Patio' } }],
      error: null,
    });
    let orderReads = 0;
    const from = vi.fn((table: string) =>
      table === 'products'
        ? products
        : table === 'restaurant_tables'
          ? tables
          : orderReads++ === 0
            ? active
            : recent,
    );
    TestBed.configureTestingModule({
      providers: [{ provide: SupabaseService, useValue: { client: { from } } }],
    });
    return { service: TestBed.inject(DashboardService), products, active, tables, recent };
  }
  it('uses exact database counts independently of the recent-order list', async () => {
    const { service, products, active, tables, recent } = setup();
    const result = await service.summary();
    expect(result.products).toBe(24);
    expect(result.activeOrders).toBe(321);
    expect(result.tables).toBe(10);
    expect(result.recentOrders).toHaveLength(1);
    expect(products.select).toHaveBeenCalledWith('id', { count: 'exact', head: true });
    expect(tables.select).toHaveBeenCalledWith('id', { count: 'exact', head: true });
    expect(active.in).toHaveBeenCalledWith('status', ACTIVE_ORDER_STATUSES);
    expect(ACTIVE_ORDER_STATUSES).toEqual(['pending', 'accepted']);
    expect(recent.limit).toHaveBeenCalledWith(5);
  });
  it('reports failed reads instead of presenting false zero counts', async () => {
    await expect(setup(true).service.summary()).rejects.toEqual({ message: 'Permission denied' });
  });
});
