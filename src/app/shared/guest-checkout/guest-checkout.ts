import { Component, Input, OnInit, OnDestroy, inject, signal } from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { GuestOrderingService, GuestTable } from '../../services/guest-ordering';
import { SupabaseService } from '../../services/supabase';
import { AdminProduct } from '../../services/admin-product';

@Component({
  selector: 'app-guest-checkout', imports: [FormsModule, CurrencyPipe, DatePipe, RouterLink],
  templateUrl: './guest-checkout.html', styleUrl: './guest-checkout.css',
})
export class GuestCheckout implements OnInit, OnDestroy {
  @Input() basketOnly = false;
  guest = inject(GuestOrderingService);
  private db = inject(SupabaseService).client;
  private route = inject(ActivatedRoute);
  tables = signal<GuestTable[]>([]);
  products = signal<(AdminProduct & { categories: { name: string } })[]>([]);
  selectedCategory = signal('All');
  categoryNames() { return ['All', ...new Set(this.products().map(p => p.categories.name))]; }
  loading = signal(true);
  notes = '';
  search = '';
  private timer?: ReturnType<typeof setInterval>;
  private refreshing = false;
  private destroyed = false;

  async ngOnInit() {
    try {
      this.tables.set(await this.guest.tables());
      const token = this.route.snapshot.queryParamMap.get('table') ?? this.guest.token();
      await this.guest.select(token);
      if (!this.basketOnly) {
        const { data, error } = await this.db.from('products').select('*, categories!inner(menuId, name, menus!inner(isActive))')
          .eq('categories.menus.isActive', true).order('name');
        if (error) throw error;
        this.products.set(data);
      }
    } catch (error) { this.guest.error.set(this.guest.describe(error)); }
    finally { this.loading.set(false); }
    if (!this.destroyed) this.timer = setInterval(() => this.refresh(), 2000);
  }
  ngOnDestroy() { this.destroyed = true; clearInterval(this.timer); }
  async refresh() {
    if (this.refreshing || this.guest.busy()) return;
    this.refreshing = true;
    try { await this.guest.refresh(); }
    catch (error) { this.guest.error.set(this.guest.describe(error)); }
    finally { this.refreshing = false; }
  }
  async select(token: string) {
    this.notes = '';
    try { await this.guest.select(token); }
    catch (error) { this.guest.error.set(this.guest.describe(error)); }
  }
  filteredProducts() {
    const search = this.search.toLowerCase();
    return this.products().filter(p => p.name.toLowerCase().includes(search) && (this.selectedCategory() === 'All' || p.categories.name === this.selectedCategory()));
  }
  requested(kind: string) { return this.guest.state()?.requests.some(r => r.kind === kind) ?? false; }
  canCheckout() { return !this.guest.busy() && (this.guest.pendingCheckout() || (!!this.guest.count() && !this.guest.state()?.basket.some(i => !i.available))); }
  statusLabel(status: string) { return status === 'pending' ? 'Awaiting staff acceptance' : status === 'cancelled' ? 'Declined / cancelled' : status; }
}
