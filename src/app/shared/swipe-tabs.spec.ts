import { swipeDestination } from './swipe-tabs';

describe('Customer tab swipes', () => {
  it('moves left and right in navigation order', () => {
    expect(swipeDestination('/menu', -120, 8, 300)).toBe('/order');
    expect(swipeDestination('/order', 120, 8, 300)).toBe('/menu');
    expect(swipeDestination('/basket', 120, 8, 300)).toBe('/order');
  });
  it('does not wrap at either end or change staff/login routes', () => {
    expect(swipeDestination('/', 120, 0, 300)).toBeNull();
    expect(swipeDestination('/basket', -120, 0, 300)).toBeNull();
    expect(swipeDestination('/admin/orders', -120, 0, 300)).toBeNull();
    expect(swipeDestination('/login', -120, 0, 300)).toBeNull();
  });
  it('ignores short, vertical, diagonal and slow gestures', () => {
    expect(swipeDestination('/menu', -30, 0, 100)).toBeNull();
    expect(swipeDestination('/menu', -90, 150, 300)).toBeNull();
    expect(swipeDestination('/menu', -90, 70, 300)).toBeNull();
    expect(swipeDestination('/menu', -120, 0, 1000)).toBeNull();
  });
});
