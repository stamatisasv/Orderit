import { Routes } from '@angular/router';

import { Home } from './pages/home/home';
import { Menu } from './pages/menu/menu';
import { Order } from './pages/order/order';
import { Basket } from './pages/basket/basket';
import { StaffActivate } from './pages/staff-activate/staff-activate';
import { Login } from './pages/login/login';

import { AdminLayout } from './admin/admin-layout/admin-layout';
import { Dashboard } from './admin/dashboard/dashboard';
import { MenuManagement } from './admin/menu-management/menu-management';
import { TablesManagement } from './admin/tables-management/tables-management';
import { OrdersManagement } from './admin/orders-management/orders-management';
import { WaitersManagement } from './admin/waiters-management/waiters-management';
import { MenuBuilder } from './admin/menu-builder/menu-builder';

import { authGuard, adminGuard } from './guards/auth.guard';

export const routes: Routes = [
  { path: 'staff/activate', component: StaffActivate },
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
        canActivate: [adminGuard],
        component: Dashboard
      },
      {
        path: 'menu',
        canActivate: [adminGuard],
        component: MenuManagement
      },
      {
        path: 'tables/:id',
        component: TablesManagement
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
        canActivate: [adminGuard],
        component: WaitersManagement
      },
      {
  path: 'menu/:id',
  canActivate: [adminGuard],
        component: MenuBuilder
} 
    ]
  }
]