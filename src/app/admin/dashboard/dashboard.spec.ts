import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { of } from 'rxjs';
import { Dashboard } from './dashboard';
import { AuthService } from '../../services/auth';
import { DashboardService } from '../../services/dashboard';

describe('Dashboard refresh', () => {
  it('keeps the last good counts during failure and clears the error on recovery', async () => {
    const summary = { products: 24, tables: 10, activeOrders: 2, recentOrders: [] };
    const read = vi.fn().mockResolvedValue(summary);
    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: { me: () => of({ admin: { username: 'Owner' } }) } },
        { provide: DashboardService, useValue: { summary: read } },
      ],
    });
    const dashboard = TestBed.runInInjectionContext(() => new Dashboard());
    await dashboard.refresh();
    read.mockRejectedValueOnce(new Error('Offline'));
    await dashboard.refresh();
    expect(dashboard.summary()?.tables).toBe(10);
    expect(dashboard.error()).toBe('Offline');
    await dashboard.refresh();
    expect(dashboard.error()).toBe('');
  });
});
