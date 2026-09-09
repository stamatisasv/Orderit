import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface AdminProduct {
  id: number;
  categoryId: number;
  name: string;
  description: string | null;
  price: string;
  imageUrl: string | null;
  isAvailable: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

interface ProductsResponse {
  products: AdminProduct[];
}

interface ProductResponse {
  message: string;
  product: AdminProduct;
}

@Injectable({
  providedIn: 'root'
})
export class AdminProductService {
  private apiUrl = 'http://localhost:3000/api/admin/menus';

  constructor(private http: HttpClient) {}

  getProducts(
    menuId: number,
    categoryId: number
  ): Observable<ProductsResponse> {
    return this.http.get<ProductsResponse>(
      `${this.apiUrl}/${menuId}/categories/${categoryId}/products`,
      { withCredentials: true }
    );
  }

  createProduct(
    menuId: number,
    categoryId: number,
    name: string,
    description: string,
    price: number,
    isAvailable: boolean
  ): Observable<ProductResponse> {
    return this.http.post<ProductResponse>(
      `${this.apiUrl}/${menuId}/categories/${categoryId}/products`,
      {
        name,
        description,
        price,
        isAvailable
      },
      {
        withCredentials: true
      }
    );
  }

  updateProduct(
    menuId: number,
    categoryId: number,
    productId: number,
    name: string,
    description: string,
    price: number,
    isAvailable: boolean
  ): Observable<ProductResponse> {
    return this.http.put<ProductResponse>(
      `${this.apiUrl}/${menuId}/categories/${categoryId}/products/${productId}`,
      {
        name,
        description,
        price,
        isAvailable
      },
      {
        withCredentials: true
      }
    );
  }

  updateAvailability(
    menuId: number,
    categoryId: number,
    productId: number,
    isAvailable: boolean
  ): Observable<ProductResponse> {
    return this.http.patch<ProductResponse>(
      `${this.apiUrl}/${menuId}/categories/${categoryId}/products/${productId}/availability`,
      {
        isAvailable
      },
      {
        withCredentials: true
      }
    );
  }

  deleteProduct(
    menuId: number,
    categoryId: number,
    productId: number
  ): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(
      `${this.apiUrl}/${menuId}/categories/${categoryId}/products/${productId}`,
      {
        withCredentials: true
      }
    );
  }

  uploadProductImage(
  menuId: number,
  categoryId: number,
  productId: number,
  image: Blob
): Observable<ProductResponse> {
  const formData = new FormData();

  formData.append(
    'image',
    image,
    'product.webp'
  );

  return this.http.post<ProductResponse>(
    `${this.apiUrl}/${menuId}/categories/${categoryId}/products/${productId}/image`,
    formData,
    {
      withCredentials: true
    }
  );
}

removeProductImage(
  menuId: number,
  categoryId: number,
  productId: number
): Observable<ProductResponse> {
  return this.http.delete<ProductResponse>(
    `${this.apiUrl}/${menuId}/categories/${categoryId}/products/${productId}/image`,
    {
      withCredentials: true
    }
  );
}


}