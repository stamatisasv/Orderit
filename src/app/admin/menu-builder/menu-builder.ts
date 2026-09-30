import { Component, OnInit, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { of, switchMap } from 'rxjs';

import {
  AdminCategory,
  AdminCategoryService
} from '../../services/admin-category';

import {
  AdminMenu,
  AdminMenuService
} from '../../services/admin-menu';

import {
  ImageCropperComponent,
  ImageCroppedEvent,
  LoadedImage
} from 'ngx-image-cropper';

import { AdminProductService } from '../../services/admin-product';
import type { AdminProduct } from '../../services/admin-product';

@Component({
  selector: 'app-menu-builder',
  imports: [
    FormsModule,
    RouterLink,
    ImageCropperComponent
  ],
  templateUrl: './menu-builder.html',
  styleUrl: './menu-builder.css'
})
export class MenuBuilder implements OnInit {
  menu = signal<AdminMenu | null>(null);
  categories = signal<AdminCategory[]>([]);
  productsByCategory = signal<Record<number, AdminProduct[]>>({});

  isLoading = signal(true);
  isSaving = signal(false);

  errorMessage = signal('');
  formError = signal('');

  showCategoryForm = signal(false);
  editingCategoryId = signal<number | null>(null);

  categoryName = '';
  categoryDescription = '';

  showProductForm = signal(false);
  editingProductId = signal<number | null>(null);
  selectedCategoryId = signal<number | null>(null);

  productName = '';
  productDescription = '';
  productPrice: number | null = null;
  productAvailable = true;

  private menuId: number;

  constructor(
    private route: ActivatedRoute,
    private adminMenuService: AdminMenuService,
    private adminCategoryService: AdminCategoryService,
    private adminProductService: AdminProductService
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

          for (const category of response.categories) {
            this.loadProducts(category.id);
          }
        },
        error: () => {
          this.errorMessage.set(
            'Unable to load categories.'
          );
          this.isLoading.set(false);
        }
      });
  }

  loadProducts(categoryId: number): void {
    this.adminProductService
      .getProducts(this.menuId, categoryId)
      .subscribe({
        next: (response) => {
          this.productsByCategory.update((current) => ({
            ...current,
            [categoryId]: response.products
          }));
        },
        error: () => {
          this.errorMessage.set(
            'Unable to load products.'
          );
        }
      });
  }

  getProducts(categoryId: number): AdminProduct[] {
    return this.productsByCategory()[categoryId] ?? [];
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
    this.categoryDescription = category.description ?? '';
    this.formError.set('');
    this.showCategoryForm.set(true);
  }

  closeCategoryForm(): void {
    if (this.isSaving()) return;

    this.showCategoryForm.set(false);
    this.editingCategoryId.set(null);
    this.formError.set('');
  }

  saveCategory(): void {
    const name = this.categoryName.trim();
    const description = this.categoryDescription.trim();

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
          error.error?.message ?? error.message ??
            'Unable to save category.'
        );
      }
    });
  }

  deleteCategory(category: AdminCategory): void {
    const confirmed = window.confirm(
      `Delete "${category.name}"?\n\nAll products inside this category will also be deleted.`
    );

    if (!confirmed) return;

    this.adminCategoryService
      .deleteCategory(this.menuId, category.id)
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

  openCreateProduct(category: AdminCategory): void {


    this.selectedCategoryId.set(category.id);
    this.editingProductId.set(null);

    this.productName = '';
    this.productDescription = '';
    this.productPrice = null;
    this.productAvailable = true;

    this.formError.set('');
    this.showProductForm.set(true);


    this.imageChangedEvent = null;
this.croppedImageBlob = null;
this.croppedImagePreview.set(null);
this.currentProductImageUrl.set(null);
this.imageError.set('');
  }

 openEditProduct(product: AdminProduct): void {
  this.selectedCategoryId.set(product.categoryId);
  this.editingProductId.set(product.id);

  this.productName = product.name;
  this.productDescription = product.description ?? '';
  this.productPrice = Number(product.price);
  this.productAvailable = product.isAvailable;

  this.imageChangedEvent = null;
  this.croppedImageBlob = null;
  this.croppedImagePreview.set(null);

  this.currentProductImageUrl.set(
    product.imageUrl
      ? product.imageUrl
      : null
  );

  this.imageError.set('');

  this.formError.set('');
  this.showProductForm.set(true);
}

  closeProductForm(): void {
    if (this.isSaving()) return;

    this.showProductForm.set(false);
    this.editingProductId.set(null);
    this.selectedCategoryId.set(null);
    this.formError.set('');
  }

  saveProduct(): void {
    if (this.isSaving()) return;
    if (this.imageError() || (this.imageChangedEvent && !this.croppedImageBlob)) {
      this.formError.set(this.imageError() || 'Wait for the image crop before saving.');
      return;
    }
    const categoryId = this.selectedCategoryId();

    if (categoryId === null) return;

    const name = this.productName.trim();
    const description = this.productDescription.trim();
    const price = Number(this.productPrice);

    if (name.length < 2) {
      this.formError.set(
        'Product name must contain at least 2 characters.'
      );
      return;
    }

    if (!Number.isFinite(price) || price < 0) {
      this.formError.set(
        'Please enter a valid price.'
      );
      return;
    }

    this.isSaving.set(true);
    this.formError.set('');

    const productId = this.editingProductId();

    const request =
      productId === null
        ? this.adminProductService.createProduct(
            this.menuId,
            categoryId,
            name,
            description,
            price,
            this.productAvailable
          )
        : this.adminProductService.updateProduct(
            this.menuId,
            categoryId,
            productId,
            name,
            description,
            price,
            this.productAvailable
          );

    request.pipe(
      switchMap((response) => {
        // Retain the saved ID if upload fails, so retry updates rather than duplicates.
        this.editingProductId.set(response.product.id);
        return this.croppedImageBlob
          ? this.adminProductService.uploadProductImage(this.menuId, categoryId, response.product.id, this.croppedImageBlob)
          : of(response);
      })
    ).subscribe({
      next: () => {
        this.isSaving.set(false);
        this.showProductForm.set(false);
        this.editingProductId.set(null);
        this.selectedCategoryId.set(null);

        this.loadProducts(categoryId);
      },
      error: (error) => {
        this.isSaving.set(false);

        this.formError.set(
          error.error?.message ?? error.message ??
            'Unable to save product.'
        );
      }
    });
  }

  toggleAvailability(product: AdminProduct): void {
    this.adminProductService
      .updateAvailability(
        this.menuId,
        product.categoryId,
        product.id,
        !product.isAvailable
      )
      .subscribe({
        next: () => {
          this.loadProducts(product.categoryId);
        },
        error: () => {
          this.errorMessage.set(
            'Unable to update product availability.'
          );
        }
      });
  }

  deleteProduct(product: AdminProduct): void {
    const confirmed = window.confirm(
      `Delete "${product.name}"?\n\nThis action cannot be undone.`
    );

    if (!confirmed) return;

    this.adminProductService
      .deleteProduct(
        this.menuId,
        product.categoryId,
        product.id
      )
      .subscribe({
        next: () => {
          this.loadProducts(product.categoryId);
        },
        error: () => {
          this.errorMessage.set(
            'Unable to delete product.'
          );
        }
      });
  }


  imageChangedEvent: Event | null = null;

croppedImageBlob: Blob | null = null;

croppedImagePreview = signal<string | null>(null);

imageError = signal('');

isUploadingImage = signal(false);

currentProductImageUrl = signal<string | null>(null);

onImageSelected(event: Event): void {
  this.imageError.set('');
  this.croppedImageBlob = null;
  this.croppedImagePreview.set(null);

  const input = event.target as HTMLInputElement;

  if (!input.files?.length) {
    return;
  }

  const file = input.files[0];

  const allowedTypes = [
    'image/jpeg',
    'image/png',
    'image/webp'
  ];

  if (!allowedTypes.includes(file.type)) {
    this.imageError.set(
      'Please select a JPG, PNG or WEBP image.'
    );
    return;
  }

  if (file.size > 5 * 1024 * 1024) {
    this.imageError.set(
      'Image must be smaller than 5 MB.'
    );
    return;
  }

  this.imageChangedEvent = event;
}

imageLoaded(image: LoadedImage): void {
  const width = image.original.size.width;
  const height = image.original.size.height;

  if (width < 800 || height < 800) {
    this.imageError.set(
      'Image must be at least 800 × 800 pixels.'
    );

    this.imageChangedEvent = null;
  }
}

imageCropped(event: ImageCroppedEvent): void {
  if (!event.blob) {
    return;
  }

  if (event.width < 800 || event.height < 800) {
    this.imageError.set(
      'The selected crop must be at least 800 × 800 pixels.'
    );

    this.croppedImageBlob = null;
    this.croppedImagePreview.set(null);

    return;
  }

  this.imageError.set('');

  this.croppedImageBlob = event.blob;

  if (event.objectUrl) {
    this.croppedImagePreview.set(
      event.objectUrl
    );
  }
}

loadImageFailed(): void {
  this.imageError.set(
    'Unable to load this image.'
  );
}

}