import { Injectable, inject } from '@angular/core';
import { SupabaseService } from './supabase';
import { OrderStatus } from './staff-management';

export const ACTIVE_ORDER_STATUSES: OrderStatus[] = ['pending', 'accepted'];
export interface RecentOrder {
  id: string;
  table_id: number;
  status: OrderStatus;
  total: number;
  createdAt: string;
  restaurant_tables: { name: string } | null;
}
export interface DashboardSummary {
  products: number;
  activeOrders: number;
  tables: number;
  recentOrders: RecentOrder[];
}

@Injectable({ providedIn: 'root' })
export class DashboardService {
  private db = inject(SupabaseService).client;

  async summary(): Promise<DashboardSummary> {
    const results = await Promise.all([
      this.db.from('products').select('id', { count: 'exact', head: true }),
      this.db
        .from('orders')
        .select('id', { count: 'exact', head: true })
        .in('status', ACTIVE_ORDER_STATUSES),
      this.db.from('restaurant_tables').select('id', { count: 'exact', head: true }),
      this.db
        .from('orders')
        .select('id, table_id, status, total, createdAt, restaurant_tables(name)')
        .order('createdAt', { ascending: false })
        .limit(5),
    ]);
    for (const result of results) if (result.error) throw result.error;
    const [products, orders, tables, recent] = results;
    if ([products, orders, tables].some((result) => typeof result.count !== 'number')) {
      throw new Error('Dashboard counts were not returned. Please refresh.');
    }
    return {
      products: products.count!,
      activeOrders: orders.count!,
      tables: tables.count!,
      recentOrders: (recent.data ?? []) as unknown as RecentOrder[],
    };
  }
}
