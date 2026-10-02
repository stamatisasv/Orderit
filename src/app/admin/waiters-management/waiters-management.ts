import { Component, OnInit, ViewChild, ElementRef, inject, signal, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Waiter, WaitersManagementService } from '../../services/waiters-management';

@Component({
  imports: [FormsModule],
  selector: 'app-waiters-management',
  styleUrl: './waiters-management.css',
  templateUrl: './waiters-management.html',
})
export class WaitersManagement implements OnInit {
  @ViewChild('nameInput') set nameInput(input: ElementRef<HTMLInputElement> | undefined) {
    input?.nativeElement.focus();
  }
  @ViewChild('keepAccess') set keepAccess(button: ElementRef<HTMLButtonElement> | undefined) {
    button?.nativeElement.focus();
  }
  private service = inject(WaitersManagementService);
  waiters = signal<Waiter[]>([]);
  loading = signal(true);
  busy = signal(false);
  error = signal('');
  message = signal('');
  configured = signal(false);
  query = signal('');
  filtered = computed(() => {
    const query = this.query().trim().toLocaleLowerCase();
    return this.waiters().filter((w) => `${w.name} ${w.email}`.toLocaleLowerCase().includes(query));
  });
  editing = signal(false);
  removing = signal<Waiter | null>(null);
  selected: Waiter | null = null;
  name = '';
  email = '';
  password = '';
  accountMode: 'new' | 'existing' = 'new';

  async ngOnInit() {
    await this.refresh();
  }
  async refresh() {
    if (this.loading() && this.configured()) return;
    this.loading.set(true);
    try {
      this.waiters.set(await this.service.list());
      this.configured.set(true);
      this.error.set('');
    } catch (error) {
      this.error.set(this.describe(error));
    } finally {
      this.loading.set(false);
    }
  }
  edit(waiter?: Waiter) {
    this.password = '';
    this.accountMode = 'new';
    this.selected = waiter ?? null;
    this.name = waiter?.name ?? '';
    this.email = waiter?.email ?? '';
    this.error.set('');
    this.message.set('');
    this.editing.set(true);
  }
  close() {
    this.password = '';
    this.editing.set(false);
  }
  async save() {
    if (this.busy()) return;
    if (
      this.name.trim().length < 2 ||
      this.name.trim().length > 100 ||
      (!this.selected && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.email.trim()))
    ) {
      this.error.set('Enter a name with 2–100 characters and a valid email address.');
      return;
    }
    if (
      !this.selected &&
      this.accountMode === 'new' &&
      (this.password.length < 8 || this.password.length > 128)
    ) {
      this.error.set('Use an initial password with 8–128 characters.');
      return;
    }
    const selected = this.selected;
    await this.perform(
      async () => {
        if (selected) await this.service.rename(selected, this.name);
        else if (this.accountMode === 'existing') await this.service.add(this.email, this.name);
        else await this.service.create(this.email, this.name, this.password);
        this.close();
      },
      selected
        ? 'Waiter updated.'
        : this.accountMode === 'new'
          ? 'Waiter created. Share their email and initial password privately so they can sign in.'
          : 'Waiter access added. They can sign in with their existing password.',
    );
  }
  async remove() {
    const waiter = this.removing();
    if (!waiter || this.busy()) return;
    await this.perform(async () => {
      await this.service.remove(waiter);
      this.removing.set(null);
    }, 'Waiter access removed. Their sign-in account is retained.');
  }
  private async perform(action: () => Promise<void>, message: string) {
    this.busy.set(true);
    this.error.set('');
    this.message.set('');
    try {
      await action();
      this.message.set(message);
      await this.refresh();
    } catch (error) {
      this.error.set(this.describe(error));
    } finally {
      this.busy.set(false);
    }
  }
  private describe(error: unknown) {
    const message =
      (error as { message?: string }).message ?? 'Unable to update waiters. Please try again.';
    return message.includes('schema cache') || message.includes('function public.')
      ? 'Waiter management is not configured yet. Ask the owner to complete the waiter management setup.'
      : message;
  }
}
