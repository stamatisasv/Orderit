import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../services/auth';
import { RestaurantTable, StaffManagementService } from '../../services/staff-management';

@Component({
  imports: [FormsModule, RouterLink], selector: 'app-tables-management',
  styleUrl: './tables-management.css', templateUrl: './tables-management.html',
})
export class TablesManagement implements OnInit {
  private service = inject(StaffManagementService);
  private auth = inject(AuthService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  tableId = signal<number | null>(null);
  visibleTables = computed(() => this.tableId() === null ? this.tables() : this.tables().filter(t => t.id === this.tableId()));
  constructor() {
    this.route.paramMap.pipe(takeUntilDestroyed()).subscribe(params => {
      const id = params.get('id');
      this.tableId.set(id === null ? null : Number(id));
      this.showForm.set(false);
    });
  }
  tables = signal<RestaurantTable[]>([]);
  isAdmin = signal(false);
  loading = signal(true);
  busy = signal(false);
  error = signal('');
  message = signal('');
  showForm = signal(false);
  editingId: number | null = null;
  name = '';
  active = true;

  async ngOnInit() {
    try {
      const { admin } = await firstValueFrom(this.auth.me());
      this.isAdmin.set(admin.role === 'admin');
      await this.load();
    } catch (e) { this.error.set(this.describe(e)); this.loading.set(false); }
  }
  async load() {
    this.loading.set(true);
    try { this.tables.set(await this.service.tables()); }
    finally { this.loading.set(false); }
  }
  async refresh() { this.error.set(''); try { await this.load(); } catch (e) { this.error.set(this.describe(e)); } }
  edit(table?: RestaurantTable) {
    this.editingId = table?.id ?? null; this.name = table?.name ?? '';
    this.active = table?.is_active ?? true; this.error.set(''); this.showForm.set(true);
  }
  async save() {
    if (!this.name.trim() || this.busy()) return;
    await this.perform(async () => {
      await this.service.saveTable(this.editingId, this.name, this.active);
      this.showForm.set(false);
    }, 'Table saved.');
  }
  async remove(table: RestaurantTable) {
    if (!confirm(`Delete ${table.name}? Tables with order history must be deactivated instead.`)) return;
    await this.perform(async () => {
      await this.service.deleteTable(table.id);
      if (this.tableId() !== null) await this.router.navigate(['/admin/tables']);
    }, 'Table deleted.');
  }
  async newVisit(table: RestaurantTable) {
    if (!confirm(`Start a new visit for ${table.name}? This clears the shared basket and hides previous guests' orders. Order history is retained for staff.`)) return;
    await this.perform(() => this.service.startVisit(table.id), 'New visit started.');
  }
  async rotate(table: RestaurantTable) {
    if (!confirm(`Replace the QR link for ${table.name}? Its old printed QR code will stop working.`)) return;
    await this.perform(() => this.service.rotateToken(table.id), 'QR link replaced. Print a new code for this table.');
  }
  link(table: RestaurantTable) { return `${window.location.origin}/order?table=${table.qr_token}`; }
  async copy(table: RestaurantTable) {
    try { await navigator.clipboard.writeText(this.link(table)); this.message.set('Table link copied.'); }
    catch { this.error.set('Could not copy automatically. Copy the link shown on the card.'); }
  }
  private async perform(action: () => Promise<void>, message: string) {
    if (this.busy()) return;
    this.busy.set(true); this.error.set(''); this.message.set('');
    try { await action(); this.message.set(message); await this.load(); }
    catch (e) { this.error.set(this.describe(e)); }
    finally { this.busy.set(false); }
  }
  private describe(e: unknown) { return (e as { message?: string }).message ?? 'Unable to update tables.'; }
}
