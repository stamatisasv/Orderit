import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { SupabaseService } from '../../services/supabase';
import { AuthService } from '../../services/auth';
import { StaffActivate } from './staff-activate';

describe('Staff invitation activation', () => {
  function setup() {
    const updateUser = vi.fn().mockResolvedValue({ error: null });
    const getUser = vi
      .fn()
      .mockResolvedValue({ data: { user: { email: 'alex@example.com' } }, error: null });
    const navigate = vi.fn().mockResolvedValue(true);
    TestBed.configureTestingModule({
      providers: [
        { provide: SupabaseService, useValue: { client: { auth: { updateUser, getUser } } } },
        { provide: AuthService, useValue: { me: () => of({ admin: { role: 'waiter' } }) } },
        { provide: Router, useValue: { navigate } },
      ],
    });
    return {
      page: TestBed.runInInjectionContext(() => new StaffActivate()),
      updateUser,
      getUser,
      navigate,
    };
  }
  it('requires a valid invitation session before changing a password', async () => {
    const { page, getUser, updateUser } = setup();
    getUser.mockResolvedValueOnce({ data: { user: null }, error: null });
    await page.ngOnInit();
    await page.save();
    expect(page.valid()).toBe(false);
    expect(updateUser).not.toHaveBeenCalled();
  });
  it('requires matching passwords and opens waiter orders after success', async () => {
    const { page, updateUser, navigate } = setup();
    await page.ngOnInit();
    page.password = 'a-test-password';
    page.confirmation = 'different';
    await page.save();
    expect(updateUser).not.toHaveBeenCalled();
    page.confirmation = page.password;
    await page.save();
    expect(updateUser).toHaveBeenCalledWith({ password: 'a-test-password' });
    expect(navigate).toHaveBeenCalledWith(['/admin/orders']);
    expect(page.password).toBe('');
  });
});
