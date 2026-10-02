import { Injectable, inject } from '@angular/core';
import { SupabaseService } from './supabase';
import { AdminProduct } from './admin-product';

export interface RestaurantTable {
  id: number; name: string; qr_token: string; is_active: boolean;
}
export const ORDER_STATUSES = ['pending', 'accepted', 'served', 'cancelled'] as const;
export type OrderStatus = typeof ORDER_STATUSES[number];
export interface OrderItem {
  id: number; product_id: number | null; product_name: string;
  unit_price: number; quantity: number; line_total: number;
}
export interface StaffOrder {
  id: string; table_id: number; status: OrderStatus; notes: string;
  total: number; createdAt: string; updatedAt: string; order_items: OrderItem[];
}
export interface DraftItem { item_id?: number; product_id?: number; name: string; price: number; quantity: number; }

export interface TableRequest { id: string; table_id: number; kind: 'waiter' | 'bill'; status: string; created_at: string; }

@Injectable({ providedIn: 'root' })
export class StaffManagementService {
  private db = inject(SupabaseService).client;
  async requests(): Promise<TableRequest[]> {
    const { data, error } = await this.db.from('table_requests').select('*').neq('status', 'done').order('created_at');
    if (error) throw error;
    return data;
  }
  async handleRequest(id: string, status: string) {
    const { error } = await this.db.rpc('handle_table_request', { p_id: id, p_status: status });
    if (error) throw error;
  }
  async startVisit(tableId: number) {
    const { error } = await this.db.rpc('start_table_visit', { p_table: tableId });
    if (error) throw error;
  }
  async tables(): Promise<RestaurantTable[]> {
    const { data, error } = await this.db.from('restaurant_tables').select('*').order('id');
    if (error) throw error;
    return data;
  }
  async saveTable(id: number | null, name: string, is_active: boolean) {
    const values = { name: name.trim(), is_active };
    const query = id === null ? this.db.from('restaurant_tables').insert(values)
      : this.db.from('restaurant_tables').update(values).eq('id', id);
    const { error } = await query.select('id').single();
    if (error) throw error;
  }
  async deleteTable(id: number) {
    const { error } = await this.db.from('restaurant_tables').delete().eq('id', id).select('id').single();
    if (error?.code === '23503') throw new Error('This table has order history. Deactivate it instead of deleting it.');
    if (error) throw error;
  }
  async rotateToken(id: number) {
    const { error } = await this.db.from('restaurant_tables').update({ qr_token: crypto.randomUUID() }).eq('id', id).select('id').single();
    if (error) throw error;
  }
  async orders(status: string, tableId: number | null): Promise<StaffOrder[]> {
    let query = this.db.from('orders').select('*, order_items(*)').order('createdAt', { ascending: false }).limit(200);
    if (status) query = query.eq('status', status);
    if (tableId !== null) query = query.eq('table_id', tableId);
    const { data, error } = await query;
    if (error) throw error;
    return data;
  }
  async products(): Promise<AdminProduct[]> {
    const { data: menu, error } = await this.db.from('menus').select('id').eq('isActive', true).maybeSingle();
    if (error) throw error;
    if (!menu) return [];
    const { data, error: productError } = await this.db.from('products')
      .select('*, categories!inner(menuId)').eq('categories.menuId', menu.id).eq('isAvailable', true).order('name');
    if (productError) throw productError;
    return data;
  }
  async saveOrder(id: string, tableId: number, notes: string, items: DraftItem[], expected: string | null) {
    const { error } = await this.db.rpc('save_staff_order', {
      p_id: id, p_table_id: tableId, p_notes: notes,
      p_items: items.map(i => ({ item_id: i.item_id, product_id: i.product_id, quantity: i.quantity })),
      p_expected_updated_at: expected,
    });
    if (error) throw error;
  }
  async setStatus(order: StaffOrder, status: string) {
    const { error } = await this.db.rpc('set_order_status', { p_id: order.id, p_status: status, p_expected_updated_at: order.updatedAt });
    if (error) throw error;
  }
  async deleteOrder(order: StaffOrder) {
    const { error } = await this.db.rpc('delete_staff_order', { p_id: order.id, p_expected_updated_at: order.updatedAt });
    if (error) throw error;
  }
}
