import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

interface LoginResponse {
  message: string;
  admin: {
    id: number;
    username: string;
  };
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private apiUrl = 'http://localhost:3000/api/auth';

  constructor(private http: HttpClient) {}

  login(username: string, password: string): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(
      `${this.apiUrl}/login`,
      {
        username,
        password
      },
      {
        withCredentials: true
      }
    );
  }

  me(): Observable<{ admin: { id: number; username: string } }> {
    return this.http.get<{ admin: { id: number; username: string } }>(
      `${this.apiUrl}/me`,
      {
        withCredentials: true
      }
    );
  }

  logout(): Observable<{ message: string }> {
  return this.http.post<{ message: string }>(
    `${this.apiUrl}/logout`,
    {},
    {
      withCredentials: true
    }
  );
}
}