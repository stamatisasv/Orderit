import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface AdminCategory {
  id: number;
  menuId: number;
  name: string;
  description: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

interface CategoriesResponse {
  categories: AdminCategory[];
}

interface CategoryResponse {
  message: string;
  category: AdminCategory;
}

@Injectable({
  providedIn: 'root'
})
export class AdminCategoryService {
  private apiUrl = 'http://localhost:3000/api/admin/menus';

  constructor(private http: HttpClient) {}

  getCategories(menuId: number): Observable<CategoriesResponse> {
    return this.http.get<CategoriesResponse>(
      `${this.apiUrl}/${menuId}/categories`,
      { withCredentials: true }
    );
  }

  createCategory(
    menuId: number,
    name: string,
    description: string
  ): Observable<CategoryResponse> {
    return this.http.post<CategoryResponse>(
      `${this.apiUrl}/${menuId}/categories`,
      {
        name,
        description
      },
      {
        withCredentials: true
      }
    );
  }

  updateCategory(
    menuId: number,
    categoryId: number,
    name: string,
    description: string
  ): Observable<CategoryResponse> {
    return this.http.put<CategoryResponse>(
      `${this.apiUrl}/${menuId}/categories/${categoryId}`,
      {
        name,
        description
      },
      {
        withCredentials: true
      }
    );
  }

  deleteCategory(
    menuId: number,
    categoryId: number
  ): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(
      `${this.apiUrl}/${menuId}/categories/${categoryId}`,
      {
        withCredentials: true
      }
    );
  }
}