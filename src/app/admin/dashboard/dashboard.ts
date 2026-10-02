import { Component, OnInit, OnDestroy, inject, signal } from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../services/auth';
import { DashboardService, DashboardSummary } from '../../services/dashboard';

@Component({
  selector: 'app-dashboard',
  imports: [RouterLink, CurrencyPipe, DatePipe],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
})
export class Dashboard implements OnInit, OnDestroy {
  private auth = inject(AuthService);
  private service = inject(DashboardService);
  username = signal('');
  summary = signal<DashboardSummary | null>(null);
  refreshing = signal(false);
  error = signal('');
  updatedAt = signal<Date | null>(null);
  private timer?: ReturnType<typeof setInterval>;
  private destroyed = false;

  async ngOnInit() {
    try {
      this.username.set((await firstValueFrom(this.auth.me())).admin.username);
    } catch {
      this.username.set('');
    }
    await this.refresh();
    if (!this.destroyed)
      this.timer = setInterval(() => {
        if (!document.hidden) void this.refresh();
      }, 5000);
  }
  ngOnDestroy() {
    this.destroyed = true;
    clearInterval(this.timer);
  }
  async refresh() {
    if (this.refreshing()) return;
    this.refreshing.set(true);
    try {
      const summary = await this.service.summary();
      if (this.destroyed) return;
      this.summary.set(summary);
      this.updatedAt.set(new Date());
      this.error.set('');
    } catch (error) {
      if (!this.destroyed)
        this.error.set((error as { message?: string }).message ?? 'Unable to load dashboard data.');
    } finally {
      this.refreshing.set(false);
    }
  }
}
