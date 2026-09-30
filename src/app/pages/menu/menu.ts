import { Component, OnInit, inject, signal } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { SupabaseService } from '../../services/supabase';
import { AdminMenu } from '../../services/admin-menu';
import { AdminCategory } from '../../services/admin-category';
import { AdminProduct } from '../../services/admin-product';

@Component({
  imports: [CurrencyPipe, RouterLink],
  selector: 'app-menu',
  styleUrl: './menu.css',
  templateUrl: './menu.html',
})
export class Menu implements OnInit {
  private db = inject(SupabaseService).client;
  private route = inject(ActivatedRoute);
  menu = signal<AdminMenu | null>(null);
  categories = signal<AdminCategory[]>([]);
  products = signal<AdminProduct[]>([]);
  tableName = signal('');
  tableToken = this.route.snapshot.queryParamMap.get('table');
  loading = signal(true);
  error = signal('');

  async ngOnInit() {
    try {
      const token = this.route.snapshot.queryParamMap.get('table');
      if (token) {
        const { data, error } = await this.db.rpc('resolve_table', { p_token: token });
        if (error) throw error;
        if (!data?.length) throw new Error('This table link is invalid or inactive.');
        this.tableName.set(data[0].name);
      }
      const { data: menu, error } = await this.db.from('menus').select('*').eq('isActive', true).maybeSingle();
      if (error) throw error;
      this.menu.set(menu);
      if (!menu) return;
      const { data: categories, error: categoryError } = await this.db.from('categories').select('*').eq('menuId', menu.id).order('sortOrder').order('id');
      if (categoryError) throw categoryError;
      this.categories.set(categories);
      if (!categories.length) return;
      const { data: products, error: productError } = await this.db.from('products').select('*').in('categoryId', categories.map(c => c.id)).order('sortOrder').order('id');
      if (productError) throw productError;
      this.products.set(products);
    } catch (error) {
      this.error.set((error as { message?: string }).message ?? 'Unable to load the menu.');
    } finally {
      this.loading.set(false);
    }
  }

  productsFor(categoryId: number) {
    return this.products().filter(product => product.categoryId === categoryId);
  }
}
