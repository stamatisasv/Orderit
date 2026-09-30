import { Directive, HostListener, inject } from '@angular/core';
import { Router } from '@angular/router';

export const CUSTOMER_TABS = ['/', '/menu', '/order', '/basket'];

export function swipeDestination(path: string, dx: number, dy: number, elapsed: number): string | null {
  const index = CUSTOMER_TABS.indexOf(path);
  if (index < 0 || Math.abs(dx) < 75 || Math.abs(dx) < Math.abs(dy) * 2 || elapsed > 700) return null;
  return CUSTOMER_TABS[index + (dx < 0 ? 1 : -1)] ?? null;
}

@Directive({ selector: '[appSwipeTabs]' })
export class SwipeTabs {
  private router = inject(Router);
  private start: { x: number; y: number; time: number; path: string } | null = null;

  @HostListener('touchstart', ['$event'])
  begin(event: TouchEvent) {
    this.start = null;
    if (!window.matchMedia('(max-width: 700px)').matches || event.touches.length !== 1) return;
    const target = event.target;
    if (!(target instanceof Element) || target.closest('a,button,input,textarea,select,summary,[contenteditable],.modal-backdrop,.category-tabs')) return;
    // Let nested horizontal scrollers handle their own gestures.
    for (let node: Element | null = target; node; node = node.parentElement) {
      if (node.scrollWidth > node.clientWidth + 1 && /auto|scroll/.test(getComputedStyle(node).overflowX)) return;
    }
    const touch = event.touches[0];
    // Reserve the screen edges for the browser's back/forward gestures.
    if (touch.clientX < 25 || touch.clientX > window.innerWidth - 25) return;
    const path = this.router.url.split(/[?#]/)[0];
    if (!CUSTOMER_TABS.includes(path)) return;
    this.start = { x: touch.clientX, y: touch.clientY, time: Date.now(), path };
  }

  @HostListener('touchmove', ['$event'])
  move(event: TouchEvent) {
    if (!this.start) return;
    if (event.touches.length !== 1) { this.start = null; return; }
    const touch = event.touches[0];
    const dx = Math.abs(touch.clientX - this.start.x), dy = Math.abs(touch.clientY - this.start.y);
    if (dy > 20 && dy > dx) this.start = null;
  }

  @HostListener('touchcancel')
  cancel() { this.start = null; }

  @HostListener('touchend', ['$event'])
  end(event: TouchEvent) {
    const start = this.start;
    this.start = null;
    if (!start || event.changedTouches.length !== 1 || event.touches.length !== 0) return;
    if (this.router.url.split(/[?#]/)[0] !== start.path) return;
    const touch = event.changedTouches[0];
    const destination = swipeDestination(start.path, touch.clientX - start.x, touch.clientY - start.y, Date.now() - start.time);
    if (destination !== null) {
      void this.router.navigate([destination], { queryParamsHandling: 'preserve' });
    }
  }
}
