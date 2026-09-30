import { Injectable, inject } from '@angular/core';
import { defer } from 'rxjs';
import { SupabaseService } from './supabase';

export interface AdminProduct {
  id: number;
  categoryId: number;
  name: string;
  description: string | null;
  price: number;
  imageUrl: string | null;
  isAvailable: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

@Injectable({ providedIn: 'root' })
export class AdminProductService {
  private db = inject(SupabaseService).client;

  private async checkCategory(menuId: number, categoryId: number) {
    const { error } = await this.db.from('categories').select('id').eq('id', categoryId).eq('menuId', menuId).single();
    if (error) throw error;
  }

  getProducts(menuId: number, categoryId: number) {
    return defer(async () => {
      await this.checkCategory(menuId, categoryId);
      const { data, error } = await this.db.from('products').select('*').eq('categoryId', categoryId).order('sortOrder').order('id');
      if (error) throw error;
      return { products: data as AdminProduct[] };
    });
  }

  createProduct(menuId: number, categoryId: number, name: string, description: string, price: number, isAvailable: boolean) {
    return defer(async () => {
      await this.checkCategory(menuId, categoryId);
      const { data, error } = await this.db.from('products').insert({ categoryId, name, description, price, isAvailable }).select().single();
      if (error) throw error;
      return { product: data as AdminProduct, message: 'Product created.' };
    });
  }

  private async update(menuId: number, categoryId: number, id: number, values: Partial<AdminProduct>) {
    await this.checkCategory(menuId, categoryId);
    const { data, error } = await this.db.from('products').update(values).eq('id', id).eq('categoryId', categoryId).select().single();
    if (error) throw error;
    return { product: data as AdminProduct, message: 'Product updated.' };
  }

  updateProduct(menuId: number, categoryId: number, id: number, name: string, description: string, price: number, isAvailable: boolean) {
    return defer(() => this.update(menuId, categoryId, id, { name, description, price, isAvailable }));
  }

  updateAvailability(menuId: number, categoryId: number, id: number, isAvailable: boolean) {
    return defer(() => this.update(menuId, categoryId, id, { isAvailable }));
  }

  deleteProduct(menuId: number, categoryId: number, id: number) {
    return defer(async () => {
      await this.checkCategory(menuId, categoryId);
      const { error } = await this.db.from('products').delete().eq('id', id).eq('categoryId', categoryId).select('id').single();
      if (error) throw error;
      return { message: 'Product deleted.' };
    });
  }

  uploadProductImage(menuId: number, categoryId: number, id: number, image: Blob) {
    return defer(async () => {
      await this.checkCategory(menuId, categoryId);
      const extensions: Record<string, string> = { 'image/webp': 'webp', 'image/png': 'png', 'image/jpeg': 'jpg' };
      const extension = extensions[image.type];
      if (!extension || image.size > 5 * 1024 * 1024) throw new Error('Choose a JPG, PNG or WEBP image smaller than 5 MB.');
      const bucket = this.db.storage.from('product-images');
      const path = `${id}/${crypto.randomUUID()}.${extension}`;
      const { error } = await bucket.upload(path, image, { contentType: image.type });
      if (error) throw error;
      try {
        const { data } = bucket.getPublicUrl(path);
        return await this.update(menuId, categoryId, id, { imageUrl: data.publicUrl });
      } catch (error) {
        await bucket.remove([path]);
        throw error;
      }
    });
  }

  removeProductImage(menuId: number, categoryId: number, id: number) {
    return defer(() => this.update(menuId, categoryId, id, { imageUrl: null }));
  }
}
