import { Injectable, computed, inject, signal } from '@angular/core';
import { SupabaseService } from './supabase';

export interface GuestTable { id: number; name: string; qr_token: string; }
export interface SharedBasketItem { product_id: number; name: string; price: number; quantity: number; available: boolean; }
export interface TableOrder { id: string; status: string; total: number; notes: string; createdAt: string; items: { name: string; quantity: number; total: number }[]; }
export interface TableState {
  id: number; name: string; visit_id: string; version: number; basket: SharedBasketItem[];
  orders: TableOrder[]; requests: { kind: string; status: string }[];
}

@Injectable({ providedIn: 'root' })
export class GuestOrderingService {
  private db = inject(SupabaseService).client;
  token = signal(sessionStorage.getItem('orderit-table') ?? '');
  state = signal<TableState | null>(null);
  error = signal('');
  message = signal('');
  busy = signal(false);
  total = computed(() => this.state()?.basket.reduce((sum, i) => sum + Number(i.price) * i.quantity, 0) ?? 0);
  count = computed(() => this.state()?.basket.reduce((sum, i) => sum + i.quantity, 0) ?? 0);
  private epoch = 0;
  private readSequence = 0;
  private appliedSequence = 0;

  async tables(): Promise<GuestTable[]> {
    const { data, error } = await this.db.rpc('guest_tables');
    if (error) throw error;
    return data;
  }
  async select(token: string) {
    this.epoch++; this.token.set(token); this.state.set(null); this.error.set(''); this.message.set('');
    sessionStorage.setItem('orderit-table', token);
    if (token) await this.refresh();
  }
  async refresh() {
    const token = this.token();
    if (!token) return;
    const epoch = this.epoch, sequence = ++this.readSequence;
    const { data, error } = await this.db.rpc('guest_table_state', { p_token: token });
    if (epoch !== this.epoch || sequence < this.appliedSequence) return;
    this.appliedSequence = sequence;
    if (error) { this.error.set(this.describe(error)); return; }
    this.state.set(data as TableState);
  }
  async change(productId: number, delta: number) {
    const state = this.state();
    if (!state || this.busy()) return;
    await this.perform(async () => {
      const { error } = await this.db.rpc('change_table_basket', {
        p_token: this.token(), p_visit: state.visit_id, p_product: productId,
        p_delta: delta, p_operation: crypto.randomUUID(),
      });
      if (error) throw error;
    });
  }
  pendingCheckout() {
    const state = this.state();
    return !!state && !!sessionStorage.getItem(`orderit-checkout-${state.id}-${state.visit_id}`);
  }
  async checkout(notes: string) {
    const state = this.state();
    if (!state || this.busy()) return;
    const key = `orderit-checkout-${state.id}-${state.visit_id}`;
    // Keep the request after a network failure so retry cannot create a duplicate.
    const requestId = sessionStorage.getItem(key) ?? crypto.randomUUID();
    sessionStorage.setItem(key, requestId);
    await this.perform(async () => {
      const { data, error } = await this.db.rpc('checkout_table_basket', {
        p_token: this.token(), p_visit: state.visit_id, p_version: state.version,
        p_request: requestId, p_notes: notes,
      });
      if (error) {
        if (error.code === 'P0001') sessionStorage.removeItem(key);
        throw error;
      }
      sessionStorage.removeItem(key);
      this.message.set(`Order ${String(data).slice(0, 8)} sent. Waiting for staff to accept it.`);
    });
  }
  async help(kind: 'waiter' | 'bill') {
    const state = this.state();
    if (!state || this.busy()) return;
    await this.perform(async () => {
      const { error } = await this.db.rpc('request_table_help', { p_token: this.token(), p_visit: state.visit_id, p_kind: kind });
      if (error) throw error;
      this.message.set(kind === 'waiter' ? 'A waiter has been requested.' : 'Your bill has been requested.');
    });
  }
  private async perform(action: () => Promise<void>) {
    this.busy.set(true); this.error.set(''); this.message.set('');
    try { await action(); }
    catch (error) { this.error.set(this.describe(error)); }
    finally {
      try { await this.refresh(); }
      catch (error) { this.error.set(this.describe(error)); }
      this.busy.set(false);
    }
  }
  describe(error: unknown) {
    const message = (error as { message?: string }).message ?? 'Unable to connect. Please try again.';
    return message.includes('schema cache') ? 'Ordering is not configured yet. Please ask a member of staff.' : message;
  }
}
