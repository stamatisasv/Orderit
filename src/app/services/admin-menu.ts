import { Injectable, inject } from '@angular/core';
import { defer } from 'rxjs';
import { SupabaseService } from './supabase';

export interface AdminMenu {
  id: number;
  name: string;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}


@Injectable({ providedIn: 'root' })
export class AdminMenuService {

  private db = inject(SupabaseService).client;

  getMenus() { return defer(async () => {
    const { data, error } = await this.db.from('menus').select('*').order('id');
    if (error) throw error;
    return { menus: data as AdminMenu[] };
  }); }
  getMenu(id: number) { return defer(async () => {
    const { data, error } = await this.db.from('menus').select('*').eq('id', id).single();
    if (error) throw error;
    return { menu: data as AdminMenu };
  }); }
  createMenu(name: string, description: string) { return defer(async () => {
    const { data, error } = await this.db.from('menus').insert({ name, description }).select().single();
    if (error) throw error;
    return { menu: data as AdminMenu, message: 'Menu created.' };
  }); }
  updateMenu(id: number, name: string, description: string) { return defer(async () => {
    const { data, error } = await this.db.from('menus').update({ name, description }).eq('id', id).select().single();
    if (error) throw error;
    return { menu: data as AdminMenu, message: 'Menu updated.' };
  }); }
  activateMenu(id: number) { return defer(async () => {
    const { error } = await this.db.rpc('activate_menu', { p_menu_id: id });
    if (error) throw error;
    return { message: 'Menu activated.' };
  }); }
  deleteMenu(id: number) { return defer(async () => {
    const { error } = await this.db.from('menus').delete().eq('id', id).select('id').single();
    if (error) throw error;
    return { message: 'Menu deleted.' };
  }); }
}
