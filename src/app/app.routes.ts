import { Routes } from '@angular/router';

import { Home } from './pages/home/home';
import { Menu } from './pages/menu/menu';
import { Order } from './pages/order/order';
import { Basket } from './pages/basket/basket';
import { Login } from './pages/login/login';

import { AdminLayout } from './admin/admin-layout/admin-layout';
import { Dashboard } from './admin/dashboard/dashboard';
import { MenuManagement } from './admin/menu-management/menu-management';
import { TablesManagement } from './admin/tables-management/tables-management';
import { OrdersManagement } from './admin/orders-management/orders-management';
import { WaitersManagement } from './admin/waiters-management/waiters-management';
import { MenuBuilder } from './admin/menu-builder/menu-builder';

import { authGuard } from './guards/auth.guard';

export const routes: Routes = [
  {
    path: '',
    component: Home
  },
  {
    path: 'menu',
    component: Menu
  },
  {
    path: 'order',
    component: Order
  },
  {
    path: 'basket',
    component: Basket
  },
  {
    path: 'login',
    component: Login
  },
  {
    path: 'admin',
    component: AdminLayout,
    canActivate: [authGuard],
    children: [
      {
        path: '',
        component: Dashboard
      },
      {
        path: 'menu',
        component: MenuManagement
      },
      {
        path: 'tables',
        component: TablesManagement
      },
      {
        path: 'orders',
        component: OrdersManagement
      },
      {
        path: 'waiters',
        component: WaitersManagement
      },
      {
  path: 'menu/:id',
  component: MenuBuilder
} 
    ]
  }
]