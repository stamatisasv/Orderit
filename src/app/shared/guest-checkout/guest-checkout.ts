import {
  Component,
  Input,
  OnInit,
  OnDestroy,
  ElementRef,
  ViewChild,
  inject,
  signal,
} from '@angular/core';
import { Subscription } from 'rxjs';
import { CurrencyPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { GuestOrderingService, GuestTable } from '../../services/guest-ordering';
import { SupabaseService } from '../../services/supabase';
import { AdminProduct } from '../../services/admin-product';

@Component({
  selector: 'app-guest-checkout',
  imports: [FormsModule, CurrencyPipe, RouterLink],
  templateUrl: './guest-checkout.html',
  styleUrl: './guest-checkout.css',
})
export class GuestCheckout implements OnInit, OnDestroy {
  @Input() basketOnly = false;
  guest = inject(GuestOrderingService);
  private db = inject(SupabaseService).client;
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  tables = signal<GuestTable[]>([]);
  products = signal<(AdminProduct & { categories: { name: string; sortOrder?: number } })[]>([]);
  selectedCategory = signal('All');
  categoryNames() {
    return ['All', ...new Set(this.products().map((p) => p.categories.name))];
  }
  loading = signal(true);
  menuError = signal('');
  tablesError = signal('');
  private tablesLoaded = false;
  menuConnected = signal(false);
  private lastMenuRefresh = 0;
  private readonly reconnect = () => {
    void this.refresh(true);
  };
  view = signal<'menu' | 'orders'>('menu');
  needsTable = signal(false);
  added = signal('');
  pendingProduct = signal<number | null>(null);
  @ViewChild('tableSelect') tableSelect?: ElementRef<HTMLSelectElement>;
  private routeSubscription?: Subscription;
  private toastTimer?: ReturnType<typeof setTimeout>;
  notes = '';
  search = '';
  private timer?: ReturnType<typeof setInterval>;
  private refreshing = false;
  private destroyed = false;

  async ngOnInit() {
    this.routeSubscription = this.route.queryParamMap.subscribe((params) => {
      this.view.set('menu');
      const token = params.get('table');
      if (!this.loading()) {
        if (token !== null && token !== this.guest.token()) void this.select(token);
        if (this.view() === 'menu') void this.refresh(true);
      }
    });
    try {
      await this.refreshTables();
      const token = this.route.snapshot.queryParamMap.get('table') ?? this.guest.token();
      if (token !== this.guest.token() || !this.guest.state()) await this.guest.select(token);
      else await this.guest.refresh();
      await this.refreshMenu();
    } catch (error) {
      this.guest.error.set(this.guest.describe(error));
    } finally {
      this.loading.set(false);
    }
    if (!this.destroyed) {
      this.timer = setInterval(() => this.refresh(), 2000);
      window.addEventListener('online', this.reconnect);
    }
  }
  ngOnDestroy() {
    this.destroyed = true;
    clearInterval(this.timer);
    window.removeEventListener('online', this.reconnect);
    this.routeSubscription?.unsubscribe();
    clearTimeout(this.toastTimer);
  }
  async refreshTables() {
    try {
      this.tables.set(await this.guest.tables());
      this.tablesLoaded = true;
      this.tablesError.set('');
    } catch (error) {
      this.tablesError.set(this.guest.describe(error));
    }
  }
  async refreshMenu() {
    if (this.basketOnly || this.view() === 'orders') return;
    try {
      const { data, error } = await this.db
        .from('products')
        .select('*, categories!inner(menuId, name, sortOrder, menus!inner(isActive))')
        .eq('categories.menus.isActive', true)
        .order('sortOrder')
        .order('id');
      if (error) throw error;
      if (this.destroyed) return;
      this.products.set(
        (data ?? []).sort(
          (a, b) =>
            a.categories.sortOrder - b.categories.sortOrder ||
            a.sortOrder - b.sortOrder ||
            a.id - b.id,
        ),
      );
      this.menuConnected.set(true);
      this.menuError.set('');
      this.lastMenuRefresh = Date.now();
      if (!this.categoryNames().includes(this.selectedCategory())) this.selectedCategory.set('All');
    } catch (error) {
      this.menuConnected.set(false);
      this.menuError.set(this.guest.describe(error));
    }
  }
  async refresh(forceMenu = false) {
    if (this.refreshing || this.guest.busy()) return;
    this.refreshing = true;
    try {
      if (!this.tablesLoaded || forceMenu) await this.refreshTables();
      await this.guest.refresh();
      if (forceMenu || Date.now() - this.lastMenuRefresh >= 10000) await this.refreshMenu();
    } catch (error) {
      this.guest.error.set(this.guest.describe(error));
    } finally {
      this.refreshing = false;
    }
  }
  async select(token: string) {
    this.notes = '';
    this.needsTable.set(false);
    try {
      await this.guest.select(token);
    } catch (error) {
      this.guest.error.set(this.guest.describe(error));
    }
  }
  async sendOrder() {
    await this.guest.checkout(this.notes);
    if (!this.guest.error() && this.guest.message().startsWith('Order ')) {
      this.notes = '';
      await this.router.navigate(['/order'], {
        queryParams: { table: this.guest.token(), view: 'menu' },
      });
    }
  }
  quantity(productId: number) {
    return this.guest.state()?.basket.find((item) => item.product_id === productId)?.quantity ?? 0;
  }
  async changeProduct(product: AdminProduct, delta: number) {
    if (!this.guest.state()) {
      this.needsTable.set(true);
      this.tableSelect?.nativeElement.scrollIntoView({
        block: 'center',
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
      });
      this.tableSelect?.nativeElement.focus({ preventScroll: true });
      return;
    }
    this.pendingProduct.set(product.id);
    try {
      await this.guest.change(product.id, delta);
      if (!this.guest.error() && this.guest.connected() && delta > 0) {
        this.added.set(`${product.name} added to your table`);
        clearTimeout(this.toastTimer);
        this.toastTimer = setTimeout(() => this.added.set(''), 2200);
      }
    } finally {
      this.pendingProduct.set(null);
    }
  }
  selectCategory(category: string) {
    this.selectedCategory.set(category);
  }
  filteredProducts() {
    const search = this.search.trim().toLocaleLowerCase();
    return this.products().filter(
      (p) =>
        `${p.name} ${p.description ?? ''} ${p.categories.name}`
          .toLocaleLowerCase()
          .includes(search) &&
        (this.selectedCategory() === 'All' || p.categories.name === this.selectedCategory()),
    );
  }
  requested(kind: string) {
    return this.guest.state()?.requests.some((r) => r.kind === kind) ?? false;
  }
  canCheckout() {
    return (
      this.guest.connected() &&
      !this.guest.busy() &&
      (this.guest.pendingCheckout() ||
        (!!this.guest.count() && !this.guest.state()?.basket.some((i) => !i.available)))
    );
  }
}
