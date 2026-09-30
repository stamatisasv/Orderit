import { Component } from '@angular/core';
import { GuestCheckout } from '../../shared/guest-checkout/guest-checkout';
@Component({ imports: [GuestCheckout], selector: 'app-order', templateUrl: './order.html' })
export class Order {}
