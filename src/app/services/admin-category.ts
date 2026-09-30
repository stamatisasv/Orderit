import { Injectable, inject } from '@angular/core';
import { defer } from 'rxjs';
import { SupabaseService } from './supabase';

export interface AdminCategory {
  id: number;
  menuId: number;
  name: string;
  description: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}


@Injectable({ providedIn: 'root' })
export class AdminCategoryService {

  private db = inject(SupabaseService).client;

  getCategories(menuId: number) { return defer(async () => {
    const { data, error } = await this.db.from('categories').select('*').eq('menuId', menuId).order('sortOrder').order('id');
    if (error) throw error;
    return { categories: data as AdminCategory[] };
  }); }
  createCategory(menuId: number, name: string, description: string) { return defer(async () => {
    const { data, error } = await this.db.from('categories').insert({ menuId, name, description }).select().single();
    if (error) throw error;
    return { category: data as AdminCategory, message: 'Category created.' };
  }); }
  updateCategory(menuId: number, id: number, name: string, description: string) { return defer(async () => {
    const { data, error } = await this.db.from('categories').update({ name, description }).eq('menuId', menuId).eq('id', id).select().single();
    if (error) throw error;
    return { category: data as AdminCategory, message: 'Category updated.' };
  }); }
  deleteCategory(menuId: number, id: number) { return defer(async () => {
    const { error } = await this.db.from('categories').delete().eq('menuId', menuId).eq('id', id).select('id').single();
    if (error) throw error;
    return { message: 'Category deleted.' };
  }); }
}
