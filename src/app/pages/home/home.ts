import { Component, inject } from '@angular/core';
import { GuestOrderingService } from '../../services/guest-ordering';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-home',
  imports: [RouterLink],
  templateUrl: './home.html',
  styleUrl: './home.css',
})
export class Home {
  guest = inject(GuestOrderingService);
}
