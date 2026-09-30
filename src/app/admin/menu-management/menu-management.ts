import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

import {
  AdminMenu,
  AdminMenuService
} from '../../services/admin-menu';

@Component({
  selector: 'app-menu-management',
  imports: [FormsModule],
  templateUrl: './menu-management.html',
  styleUrl: './menu-management.css'
})
export class MenuManagement implements OnInit {
  menus = signal<AdminMenu[]>([]);
  isLoading = signal(true);
  isSaving = signal(false);

  errorMessage = signal('');
  formError = signal('');

  showMenuForm = signal(false);
  editingMenuId = signal<number | null>(null);

  menuName = '';
  menuDescription = '';

  constructor(
    private adminMenuService: AdminMenuService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadMenus();
  }

  loadMenus(): void {
    this.isLoading.set(true);
    this.errorMessage.set('');

    this.adminMenuService.getMenus().subscribe({
      next: (response) => {
        this.menus.set(response.menus);
        this.isLoading.set(false);
      },
      error: () => {
        this.errorMessage.set('Unable to load menus.');
        this.isLoading.set(false);
      }
    });
  }

  openCreateForm(): void {
    this.editingMenuId.set(null);
    this.menuName = '';
    this.menuDescription = '';
    this.formError.set('');
    this.showMenuForm.set(true);
  }

  openEditForm(menu: AdminMenu): void {
    this.editingMenuId.set(menu.id);
    this.menuName = menu.name;
    this.menuDescription = menu.description ?? '';
    this.formError.set('');
    this.showMenuForm.set(true);
  }

  closeForm(): void {
    if (this.isSaving()) {
      return;
    }

    this.showMenuForm.set(false);
    this.editingMenuId.set(null);
    this.formError.set('');
  }

  saveMenu(): void {
    const name = this.menuName.trim();
    const description = this.menuDescription.trim();

    if (name.length < 2) {
      this.formError.set(
        'Menu name must contain at least 2 characters.'
      );
      return;
    }

    this.isSaving.set(true);
    this.formError.set('');

    const id = this.editingMenuId();

    const request = id === null
      ? this.adminMenuService.createMenu(name, description)
      : this.adminMenuService.updateMenu(id, name, description);

    request.subscribe({
      next: () => {
        this.isSaving.set(false);
        this.showMenuForm.set(false);
        this.editingMenuId.set(null);
        this.loadMenus();
      },
      error: (error) => {
        this.isSaving.set(false);

        this.formError.set(
          error.error?.message ?? error.message ?? 'Unable to save menu.'
        );
      }
    });
  }

  activateMenu(menu: AdminMenu): void {
    if (menu.isActive) {
      return;
    }

    this.adminMenuService.activateMenu(menu.id).subscribe({
      next: () => {
        this.loadMenus();
      },
      error: () => {
        this.errorMessage.set('Unable to activate menu.');
      }
    });
  }

  deleteMenu(menu: AdminMenu): void {
    const confirmed = window.confirm(
      `Delete "${menu.name}"?\n\nThis action cannot be undone.`
    );

    if (!confirmed) {
      return;
    }

    this.adminMenuService.deleteMenu(menu.id).subscribe({
      next: () => {
        this.loadMenus();
      },
      error: () => {
        this.errorMessage.set('Unable to delete menu.');
      }
    });
  }

  manageMenu(menu: AdminMenu): void {
    this.router.navigate(['/admin/menu', menu.id]);
  }
}