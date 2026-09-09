import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface AdminMenu {
  id: number;
  name: string;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface MenusResponse {
  menus: AdminMenu[];
}

interface MenuResponse {
  message: string;
  menu: AdminMenu;
}

@Injectable({
  providedIn: 'root'
})
export class AdminMenuService {
  private apiUrl = 'http://localhost:3000/api/admin/menus';

  constructor(private http: HttpClient) {}
getMenus(): Observable<MenusResponse> {
  return this.http.get<MenusResponse>(
    this.apiUrl,
    { withCredentials: true }
  );
}
  getMenu(id: number): Observable<{ menu: AdminMenu }> {
  return this.http.get<{ menu: AdminMenu }>(
    `${this.apiUrl}/${id}`,
    { withCredentials: true }
  );
}

  createMenu(
    name: string,
    description: string
  ): Observable<MenuResponse> {
    return this.http.post<MenuResponse>(
      this.apiUrl,
      {
        name,
        description
      },
      {
        withCredentials: true
      }
    );
  }

  updateMenu(
    id: number,
    name: string,
    description: string
  ): Observable<MenuResponse> {
    return this.http.put<MenuResponse>(
      `${this.apiUrl}/${id}`,
      {
        name,
        description
      },
      {
        withCredentials: true
      }
    );
  }

  activateMenu(id: number): Observable<MenuResponse> {
    return this.http.patch<MenuResponse>(
      `${this.apiUrl}/${id}/activate`,
      {},
      {
        withCredentials: true
      }
    );
  }

  deleteMenu(id: number): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(
      `${this.apiUrl}/${id}`,
      {
        withCredentials: true
      }
    );
  }
}