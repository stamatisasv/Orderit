import { Component, OnInit, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';

import {
  AdminCategory,
  AdminCategoryService
} from '../../services/admin-category';

import {
  AdminMenu,
  AdminMenuService
} from '../../services/admin-menu';

@Component({
  selector: 'app-menu-builder',
  imports: [
    FormsModule,
    RouterLink
  ],
  templateUrl: './menu-builder.html',
  styleUrl: './menu-builder.css'
})
export class MenuBuilder implements OnInit {
  menu = signal<AdminMenu | null>(null);
  categories = signal<AdminCategory[]>([]);

  isLoading = signal(true);
  isSaving = signal(false);

  errorMessage = signal('');
  formError = signal('');

  showCategoryForm = signal(false);
  editingCategoryId = signal<number | null>(null);

  categoryName = '';
  categoryDescription = '';

  private menuId: number;

  constructor(
    private route: ActivatedRoute,
    private adminMenuService: AdminMenuService,
    private adminCategoryService: AdminCategoryService
  ) {
    this.menuId = Number(
      this.route.snapshot.paramMap.get('id')
    );
  }

  ngOnInit(): void {
    this.loadMenu();
    this.loadCategories();
  }

  loadMenu(): void {
    this.adminMenuService.getMenu(this.menuId).subscribe({
      next: (response) => {
        this.menu.set(response.menu);
      },
      error: () => {
        this.errorMessage.set('Unable to load menu.');
      }
    });
  }

  loadCategories(): void {
    this.isLoading.set(true);

    this.adminCategoryService
      .getCategories(this.menuId)
      .subscribe({
        next: (response) => {
          this.categories.set(response.categories);
          this.isLoading.set(false);
        },
        error: () => {
          this.errorMessage.set(
            'Unable to load categories.'
          );
          this.isLoading.set(false);
        }
      });
  }

  openCreateCategory(): void {
    this.editingCategoryId.set(null);
    this.categoryName = '';
    this.categoryDescription = '';
    this.formError.set('');
    this.showCategoryForm.set(true);
  }

  openEditCategory(category: AdminCategory): void {
    this.editingCategoryId.set(category.id);
    this.categoryName = category.name;
    this.categoryDescription =
      category.description ?? '';

    this.formError.set('');
    this.showCategoryForm.set(true);
  }

  closeCategoryForm(): void {
    if (this.isSaving()) {
      return;
    }

    this.showCategoryForm.set(false);
    this.editingCategoryId.set(null);
    this.formError.set('');
  }

  saveCategory(): void {
    const name = this.categoryName.trim();
    const description =
      this.categoryDescription.trim();

    if (name.length < 2) {
      this.formError.set(
        'Category name must contain at least 2 characters.'
      );
      return;
    }

    this.isSaving.set(true);
    this.formError.set('');

    const categoryId = this.editingCategoryId();

    const request =
      categoryId === null
        ? this.adminCategoryService.createCategory(
            this.menuId,
            name,
            description
          )
        : this.adminCategoryService.updateCategory(
            this.menuId,
            categoryId,
            name,
            description
          );

    request.subscribe({
      next: () => {
        this.isSaving.set(false);
        this.showCategoryForm.set(false);
        this.editingCategoryId.set(null);
        this.loadCategories();
      },
      error: (error) => {
        this.isSaving.set(false);

        this.formError.set(
          error.error?.message ??
            'Unable to save category.'
        );
      }
    });
  }

  deleteCategory(category: AdminCategory): void {
    const confirmed = window.confirm(
      `Delete "${category.name}"?\n\nThis action cannot be undone.`
    );

    if (!confirmed) {
      return;
    }

    this.adminCategoryService
      .deleteCategory(
        this.menuId,
        category.id
      )
      .subscribe({
        next: () => {
          this.loadCategories();
        },
        error: () => {
          this.errorMessage.set(
            'Unable to delete category.'
          );
        }
      });
  }
}