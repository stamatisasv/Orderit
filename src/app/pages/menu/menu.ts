import { Component } from '@angular/core';
import { GuestCheckout } from '../../shared/guest-checkout/guest-checkout';

@Component({
  selector: 'app-menu',
  imports: [GuestCheckout],
  templateUrl: './menu.html',
})
export class Menu {}
