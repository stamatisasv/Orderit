import { Component, inject } from '@angular/core';
import { GuestOrderingService } from '../../services/guest-ordering';
import { RouterLink, RouterLinkActive } from '@angular/router';

@Component({
  selector: 'app-navbar',
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './navbar.html',
  styleUrl: './navbar.css'
})
export class Navbar {
  guest = inject(GuestOrderingService);
}