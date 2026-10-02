import { Component, OnInit, OnDestroy, inject, signal } from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../services/auth';
import { AdminProduct } from '../../services/admin-product';
import { DraftItem, ORDER_STATUSES, RestaurantTable, StaffManagementService, StaffOrder, TableRequest } from '../../services/staff-management';

@Component({
  imports: [FormsModule, CurrencyPipe, DatePipe], selector: 'app-orders-management',
  styleUrl: './orders-management.css', templateUrl: './orders-management.html',
})
export class OrdersManagement implements OnInit, OnDestroy {
  private service = inject(StaffManagementService);
  private auth = inject(AuthService);
  private route = inject(ActivatedRoute);
  requests = signal<TableRequest[]>([]);
  private timer?: ReturnType<typeof setInterval>;
  private destroyed = false;
  orders = signal<StaffOrder[]>([]);
  tables = signal<RestaurantTable[]>([]);
  products = signal<AdminProduct[]>([]);
  isAdmin = signal(false);
  loading = signal(true);
  busy = signal(false);
  error = signal('');
  message = signal('');
  editing = signal(false);
  statuses = ORDER_STATUSES;
  filterStatus = '';
  filterTable: number | null = null;
  orderId = '';
  expected: string | null = null;
  tableId: number | null = null;
  notes = '';
  lines: DraftItem[] = [];
  productId: number | null = null;
  private loadVersion = 0;

  async ngOnInit() {
    const table = Number(this.route.snapshot.queryParamMap.get('table'));
    this.filterTable = table > 0 ? table : null;
    try {
      const { admin } = await firstValueFrom(this.auth.me());
      this.isAdmin.set(admin.role === 'admin');
      this.tables.set(await this.service.tables());
      await this.refresh();
    } catch (e) { this.error.set(this.describe(e)); this.loading.set(false); }
    if (!this.destroyed) this.timer = setInterval(() => {
      if (!this.busy() && !this.editing() && !this.loading()) void this.refresh();
    }, 3000);
  }
  ngOnDestroy() { this.destroyed = true; clearInterval(this.timer); }
  async handleRequest(id: string, status: string) {
    await this.perform(() => this.service.handleRequest(id, status), 'Request updated.');
  }
  async refresh() {
    const version = ++this.loadVersion;
    this.loading.set(true); this.error.set('');
    try {
      const [orders, requests] = await Promise.all([
        this.service.orders(this.filterStatus, this.filterTable), this.service.requests()
      ]);
      if (version === this.loadVersion) this.requests.set(requests);
      if (version === this.loadVersion) this.orders.set(orders);
    } catch (e) { if (version === this.loadVersion) this.error.set(this.describe(e)); }
    finally { if (version === this.loadVersion) this.loading.set(false); }
  }
  tableName(id: number) { return this.tables().find(t => t.id === id)?.name ?? `Table ${id}`; }
  async edit(order?: StaffOrder) {
    this.error.set(''); this.busy.set(true);
    try {
      const [products, tables] = await Promise.all([this.service.products(), this.service.tables()]);
      this.products.set(products); this.tables.set(tables);
      this.orderId = order?.id ?? crypto.randomUUID();
      this.expected = order?.updatedAt ?? null;
      this.tableId = order?.table_id ?? this.filterTable;
      this.notes = order?.notes ?? '';
      this.lines = order?.order_items.map(i => ({ item_id: i.id, name: i.product_name, price: Number(i.unit_price), quantity: i.quantity })) ?? [];
      this.productId = null; this.editing.set(true);
    } catch (e) { this.error.set(this.describe(e)); }
    finally { this.busy.set(false); }
  }
  addLine() {
    const product = this.products().find(p => p.id === this.productId);
    if (!product) return;
    this.lines = [...this.lines, { product_id: product.id, name: product.name, price: Number(product.price), quantity: 1 }];
    this.productId = null;
  }
  removeLine(index: number) { this.lines = this.lines.filter((_, i) => i !== index); }
  total() { return this.lines.reduce((sum, i) => sum + i.price * i.quantity, 0); }
  async save() {
    if (this.busy()) return;
    if (!this.tableId || !this.lines.length || this.lines.length > 50 || this.lines.some(i => !Number.isInteger(i.quantity) || i.quantity < 1 || i.quantity > 99)) {
      this.error.set('Select a table and 1–50 items, with quantities between 1 and 99.'); return;
    }
    await this.perform(async () => {
      await this.service.saveOrder(this.orderId, this.tableId!, this.notes, this.lines, this.expected);
      this.editing.set(false);
    }, 'Order saved.');
  }
  allowedStatuses(order: StaffOrder) {
    if (order.status === 'pending') return ['pending', 'accepted', 'cancelled'];
    if (order.status === 'served' || order.status === 'cancelled') return [order.status, 'pending'];
    return ['accepted', 'served', 'cancelled'];
  }
  async status(order: StaffOrder, value: string) {
    if (value === order.status) return;
    if (value === 'cancelled' && !confirm('Cancel this order?')) { await this.refresh(); return; }
    await this.perform(() => this.service.setStatus(order, value), 'Status updated.');
  }
  async remove(order: StaffOrder) {
    if (!confirm(`Permanently delete order ${order.id.slice(0, 8)} and all its items? Cancel it instead if you want to keep its history.`)) return;
    await this.perform(() => this.service.deleteOrder(order), 'Order deleted.');
  }
  private async perform(action: () => Promise<void>, message: string) {
    if (this.busy()) return;
    this.busy.set(true); this.error.set(''); this.message.set('');
    try { await action(); this.message.set(message); await this.refresh(); }
    catch (e) { this.error.set(this.describe(e)); }
    finally { this.busy.set(false); }
  }
  private describe(e: unknown) {
    const message = (e as { message?: string }).message ?? 'Unable to update orders.';
    return message.includes('schema cache') || message.includes('function public.')
      ? 'Run supabase/staff-management.sql and supabase/shared-table-ordering.sql in Supabase SQL Editor.' : message;
  }
}
