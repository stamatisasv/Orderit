import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { GuestCheckout } from './guest-checkout';
import { SupabaseService } from '../../services/supabase';
import { GuestOrderingService } from '../../services/guest-ordering';

const product = {
  categoryId: 1,
  description: 'Fresh coffee',
  imageUrl: null,
  sortOrder: 0,
  createdAt: '',
  updatedAt: '',
  id: 1,
  name: 'Coffee',
  price: 3,
  isAvailable: true,
  categories: { name: 'Drinks' },
};

describe('GuestCheckout refresh', () => {
  function setup() {
    const query: any = { select: vi.fn(), eq: vi.fn(), order: vi.fn() };
    query.select.mockReturnValue(query);
    query.eq.mockReturnValue(query);
    query.order.mockReturnValueOnce(query).mockResolvedValueOnce({ data: [product], error: null });
    const navigate = vi.fn().mockResolvedValue(true);
    const rpc = vi.fn().mockResolvedValue({ data: [], error: null });
    TestBed.configureTestingModule({
      providers: [
        { provide: SupabaseService, useValue: { client: { from: () => query, rpc } } },
        { provide: ActivatedRoute, useValue: {} },
        { provide: Router, useValue: { navigate } },
      ],
    });
    const component = TestBed.runInInjectionContext(() => new GuestCheckout());
    return { component, query, rpc, navigate, guest: TestBed.inject(GuestOrderingService) };
  }
  it('refreshes price and availability, marks failed menu data stale, then recovers', async () => {
    const { component, query } = setup();
    await component.refreshMenu();
    expect(component.products()[0].price).toBe(3);
    query.order.mockReturnValueOnce(query).mockResolvedValueOnce({ error: { message: 'Offline' } });
    await component.refreshMenu();
    expect(component.menuConnected()).toBe(false);
    expect(component.menuError()).toBe('Offline');
    query.order
      .mockReturnValueOnce(query)
      .mockResolvedValueOnce({ data: [{ ...product, price: 4, isAvailable: false }], error: null });
    await component.refreshMenu();
    expect(component.products()[0].price).toBe(4);
    expect(component.products()[0].isAvailable).toBe(false);
    expect(component.menuConnected()).toBe(true);
    expect(component.menuError()).toBe('');
  });
  it('retries table discovery after an initial connection failure', async () => {
    const { component, rpc } = setup();
    rpc.mockResolvedValueOnce({ error: { message: 'Offline' } });
    await component.refreshTables();
    expect(component.tablesError()).toBe('Offline');
    component.basketOnly = true;
    await component.refresh(true);
    expect(component.tablesError()).toBe('');
    expect(rpc).toHaveBeenCalledTimes(2);
  });
  it('guides browsing guests to choose a table before adding anything', async () => {
    const { component, rpc } = setup();
    await component.changeProduct(product, 1);
    expect(component.needsTable()).toBe(true);
    expect(rpc).not.toHaveBeenCalled();
  });
  it('returns to the menu only after a confirmed submission', async () => {
    const { component, guest, navigate } = setup();
    vi.spyOn(guest, 'checkout').mockImplementation(async () => {
      guest.message.set('Order 123 sent.');
    });
    component.notes = 'Water please';
    await component.sendOrder();
    expect(component.notes).toBe('');
    expect(navigate).toHaveBeenCalledWith(
      ['/order'],
      expect.objectContaining({ queryParams: expect.objectContaining({ view: 'menu' }) }),
    );
  });
  it('keeps notes and the basket visible when submission fails', async () => {
    const { component, guest, navigate } = setup();
    vi.spyOn(guest, 'checkout').mockImplementation(async () => {
      guest.error.set('Offline');
    });
    component.notes = 'Water please';
    await component.sendOrder();
    expect(component.notes).toBe('Water please');
    expect(navigate).not.toHaveBeenCalled();
  });
});

describe('Mobile basket rendering', () => {
  it('renders the shared basket and prevents checkout while its connection is stale', async () => {
    sessionStorage.clear();
    const params = convertToParamMap({ table: 'token' });
    const state = {
      id: 1,
      name: 'Table 1',
      visit_id: 'visit',
      version: 1,
      basket: [{ product_id: 1, name: 'Coffee', price: 3, quantity: 2, available: true }],
      orders: [],
      requests: [],
    };
    const rpc = vi
      .fn()
      .mockImplementation(async (name: string) => ({
        data: name === 'guest_tables' ? [{ id: 1, name: 'Table 1', qr_token: 'token' }] : state,
        error: null,
      }));
    TestBed.configureTestingModule({
      imports: [GuestCheckout],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: { queryParamMap: of(params), snapshot: { queryParamMap: params } },
        },
        { provide: SupabaseService, useValue: { client: { rpc } } },
      ],
    });
    const fixture = TestBed.createComponent(GuestCheckout);
    fixture.componentRef.setInput('basketOnly', true);
    fixture.detectChanges();
    await vi.waitFor(() => expect(fixture.componentInstance.loading()).toBe(false));
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('.basket-line')?.textContent).toContain('Coffee');
    expect(root.querySelector('.checkout-total')?.textContent).toContain('€6.00');
    expect((root.querySelector('.send-order') as HTMLButtonElement).disabled).toBe(false);
    rpc.mockResolvedValueOnce({ data: null, error: { message: 'Offline' } });
    await fixture.componentInstance.guest.refresh();
    await fixture.whenStable();
    expect(root.querySelector('.connection-warning')?.textContent).toContain('reconnect');
    expect((root.querySelector('.send-order') as HTMLButtonElement).disabled).toBe(true);
    fixture.destroy();
  });
});
