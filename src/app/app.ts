import { Component, signal } from '@angular/core';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';

import { SwipeTabs } from './shared/swipe-tabs';
import { Navbar } from './shared/navbar/navbar';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, Navbar, SwipeTabs],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  isAdminRoute = signal(false);

  constructor(private router: Router) {
    this.updateRoute();

    this.router.events
      .pipe(
        filter(event => event instanceof NavigationEnd)
      )
      .subscribe(() => {
        this.updateRoute();
      });
  }

  private updateRoute(): void {
    this.isAdminRoute.set(
      this.router.url.startsWith('/admin')
    );
  }
}