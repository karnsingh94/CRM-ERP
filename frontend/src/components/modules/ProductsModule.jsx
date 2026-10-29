'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useRef } from 'react';
import { api, API_BASE } from '../../lib/api';
import { getStoredToken } from '../../lib/auth';
import {
  IconPlus,
  IconSearch,
  IconBox,
  IconLayers,
  IconEdit,
  IconTrash,
  IconCheckCircle,
  IconAlertTriangle,
  IconRefreshCw,
  IconPackage,
  IconCreditCard,
  IconImage,
  IconUpload,
} from '../ui/Icons';
import Modal from '../ui/Modal';
import ConfirmDialog from '../ui/ConfirmDialog';
import EmptyState from '../ui/EmptyState';


function getProductImageUrl(imageUrl, companyId, productId) {
  if (!imageUrl) return null;
  if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://') || imageUrl.startsWith('data:')) {
    return imageUrl;
  }
  const token = getStoredToken();
  const tokenQuery = token ? `?token=${encodeURIComponent(token)}` : '';
  return `${API_BASE}/companies/${companyId}/products/${productId}/image${tokenQuery}`;
}

function ProductThumbnail({ product, companyId, size = 42, onEnlarge }) {
  const [imgError, setImgError] = useState(false);
  const imageUrl = getProductImageUrl(product?.imageUrl, companyId, product?.id);

  if (imageUrl && !imgError) {
    return (
      <div
        onClick={() => onEnlarge && onEnlarge(imageUrl, product)}
        style={{
          width: `${size}px`,
          height: `${size}px`,
          borderRadius: '8px',
          overflow: 'hidden',
          border: '1px solid #e2e8f0',
          cursor: onEnlarge ? 'pointer' : 'default',
          flexShrink: 0,
          background: '#f8fafc',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
        title={onEnlarge ? 'Click to enlarge preview' : (product?.name || 'Product')}
      >
        <img
          src={imageUrl}
          alt={product?.name || 'Product'}
          onError={() => setImgError(true)}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      </div>
    );
  }

  return (
    <div
      style={{
        width: `${size}px`,
        height: `${size}px`,
        borderRadius: '8px',
        border: '1px solid #e2e8f0',
        background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#94a3b8',
        flexShrink: 0,
      }}
      title="No image uploaded"
    >
      <IconPackage size={Math.round(size * 0.48)} />
    </div>
  );
}

function ProductImageUploader({
  imageFile,
  imagePreview,
  currentImageUrl,
  onSelectImage,
  onRemoveImage,
  errorMessage,
  isRemoved = false,
}) {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onSelectImage(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      onSelectImage(e.target.files[0]);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const activePreview = imagePreview || (!isRemoved ? currentImageUrl : null);

  return (
    <div>
      <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.35rem', color: '#0f172a' }}>
        Product Image / Photo (JPEG, PNG, WebP — Max 5MB)
      </label>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />

      {activePreview ? (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '1rem',
            padding: '0.75rem 1rem',
            borderRadius: '8px',
            border: '1px solid #cbd5e1',
            background: '#f8fafc',
          }}
        >
          <div
            style={{
              width: '72px',
              height: '72px',
              borderRadius: '8px',
              overflow: 'hidden',
              border: '1px solid #e2e8f0',
              background: '#ffffff',
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <img
              src={activePreview}
              alt="Preview"
              style={{ width: '100%', height: '100%', objectFit: 'contain' }}
            />
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem' }}>
              <span style={{ fontSize: '0.84rem', fontWeight: 700, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {imageFile ? imageFile.name : 'Current Product Image'}
              </span>
              <span style={{ fontSize: '0.72rem', padding: '2px 6px', borderRadius: '4px', background: '#dcfce7', color: '#15803d', fontWeight: 700 }}>
                {imageFile ? `${(imageFile.size / (1024 * 1024)).toFixed(2)} MB` : 'Attached'}
              </span>
            </div>
            <p style={{ margin: '0 0 0.45rem 0', fontSize: '0.75rem', color: '#64748b' }}>
              {imageFile ? 'Ready to upload on save.' : 'Currently active catalogue image.'}
            </p>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                style={{
                  padding: '0.3rem 0.65rem',
                  borderRadius: '5px',
                  border: '1px solid #cbd5e1',
                  background: '#ffffff',
                  fontSize: '0.74rem',
                  fontWeight: 600,
                  color: '#334155',
                  cursor: 'pointer',
                }}
              >
                Replace Image
              </button>
              <button
                type="button"
                onClick={onRemoveImage}
                style={{
                  padding: '0.3rem 0.65rem',
                  borderRadius: '5px',
                  border: '1px solid #fecaca',
                  background: '#fff1f2',
                  fontSize: '0.74rem',
                  fontWeight: 600,
                  color: '#e11d48',
                  cursor: 'pointer',
                }}
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          style={{
            border: isDragging ? '2px dashed #7f22fe' : '2px dashed #cbd5e1',
            background: isDragging ? '#faf5ff' : '#f8fafc',
            borderRadius: '8px',
            padding: '1.25rem 1rem',
            textAlign: 'center',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
        >
          <div style={{ color: isDragging ? '#7f22fe' : '#94a3b8', marginBottom: '0.35rem', display: 'flex', justifyContent: 'center' }}>
            <IconUpload size={26} />
          </div>
          <p style={{ margin: '0 0 0.25rem 0', fontSize: '0.84rem', fontWeight: 700, color: '#334155' }}>
            Click to upload or drag &amp; drop
          </p>
          <p style={{ margin: 0, fontSize: '0.74rem', color: '#64748b' }}>
            Supported formats: JPEG, PNG, WebP (up to 5MB)
          </p>
        </div>
      )}

      {errorMessage && (
        <div style={{ marginTop: '0.35rem', fontSize: '0.75rem', color: '#dc2626', fontWeight: 600 }}>
          ⚠️ {errorMessage}
        </div>
      )}
    </div>
  );
}

export default function ProductsModule({ activeCompany, showToast, initialSubTab }) {
  const router = useRouter();
  const pathname = usePathname();

  const TAB_ROUTES = {
    all: '/products',
    categories: '/products/categories',
    pricing: '/products/pricing',
  };

  const [activeTab, setActiveTab] = useState(initialSubTab || 'all');

  useEffect(() => {
    if (initialSubTab) {
      if (activeTab !== initialSubTab) {
        setActiveTab(initialSubTab);
      }
    } else if (pathname) {
      let resolved = 'all';
      if (pathname.includes('/products/categories')) resolved = 'categories';
      else if (pathname.includes('/products/pricing')) resolved = 'pricing';
      if (activeTab !== resolved) {
        setActiveTab(resolved);
      }
    }
  }, [initialSubTab, pathname, activeTab]);

  const handleTabChange = (newTab) => {
    if (activeTab === newTab) return;
    setActiveTab(newTab);
    const targetRoute = TAB_ROUTES[newTab];
    if (targetRoute && pathname !== targetRoute) {
      router.push(targetRoute);
    }
  };

  // ---------------------------------------------------------------------------
  // SHARED DATA: Categories & Products cache
  // ---------------------------------------------------------------------------
  const [products, setProducts] = useState([]);
  const [isLoadingProducts, setIsLoadingProducts] = useState(false);

  const [categories, setCategories] = useState([]);
  const [isLoadingCategories, setIsLoadingCategories] = useState(false);

  const [pricings, setPricings] = useState([]);
  const [isLoadingPricings, setIsLoadingPricings] = useState(false);

  // 1. Load Products
  const loadProducts = useCallback(async () => {
    if (!activeCompany?.id) return;
    setIsLoadingProducts(true);
    try {
      const res = await api.get(`/companies/${activeCompany.id}/products`, { noCache: true });
      setProducts(res.data || []);
    } catch (err) {
      // Handled by UI
    } finally {
      setIsLoadingProducts(false);
    }
  }, [activeCompany?.id]);

  // 2. Load Categories
  const loadCategories = useCallback(async () => {
    if (!activeCompany?.id) return;
    setIsLoadingCategories(true);
    try {
      const res = await api.get(`/companies/${activeCompany.id}/products/categories`, { noCache: true });
      setCategories(res.data || []);
    } catch (err) {
      // Handled by UI
    } finally {
      setIsLoadingCategories(false);
    }
  }, [activeCompany?.id]);

  // 3. Load Pricings
  const loadPricings = useCallback(async () => {
    if (!activeCompany?.id) return;
    setIsLoadingPricings(true);
    try {
      const res = await api.get(`/companies/${activeCompany.id}/products/pricing`, { noCache: true });
      setPricings(res.data || []);
    } catch (err) {
      // Handled by UI
    } finally {
      setIsLoadingPricings(false);
    }
  }, [activeCompany?.id]);

  // Initial load
  useEffect(() => {
    loadProducts();
    loadCategories();
    loadPricings();
  }, [loadProducts, loadCategories, loadPricings]);

  // ---------------------------------------------------------------------------
  // TAB 1: PRODUCT DIRECTORY STATE & HANDLERS
  // ---------------------------------------------------------------------------
  const [productSearch, setProductSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');

  const [showAddProductModal, setShowAddProductModal] = useState(false);
  const [isSavingProduct, setIsSavingProduct] = useState(false);
  const [productForm, setProductForm] = useState({
    sku: '',
    name: '',
    description: '',
    category: '',
    uom: 'PCS',
    sellingPrice: '',
    purchasePrice: '',
    status: 'ACTIVE',
  });

  const [productToView, setProductToView] = useState(null);
  const [productToEdit, setProductToEdit] = useState(null);
  const [isUpdatingProduct, setIsUpdatingProduct] = useState(false);
  const [productToDelete, setProductToDelete] = useState(null);

  // Product Image States
  const [productImageFile, setProductImageFile] = useState(null);
  const [productImagePreview, setProductImagePreview] = useState('');
  const [productImageError, setProductImageError] = useState('');

  const [editImageFile, setEditImageFile] = useState(null);
  const [editImagePreview, setEditImagePreview] = useState('');
  const [editImageRemoved, setEditImageRemoved] = useState(false);
  const [editImageError, setEditImageError] = useState('');

  const [imageToEnlarge, setImageToEnlarge] = useState(null);

  const handleSelectCreateImage = (file) => {
    if (!file) return;
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowed.includes(file.type)) {
      setProductImageError('Invalid format. Only JPEG, PNG, and WebP images are allowed.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setProductImageError('File is too large. Maximum size is 5MB.');
      return;
    }
    setProductImageError('');
    setProductImageFile(file);
    if (productImagePreview) URL.revokeObjectURL(productImagePreview);
    setProductImagePreview(URL.createObjectURL(file));
  };

  const handleRemoveCreateImage = () => {
    if (productImagePreview) URL.revokeObjectURL(productImagePreview);
    setProductImageFile(null);
    setProductImagePreview('');
    setProductImageError('');
  };

  const handleSelectEditImage = (file) => {
    if (!file) return;
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowed.includes(file.type)) {
      setEditImageError('Invalid format. Only JPEG, PNG, and WebP images are allowed.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setEditImageError('File is too large. Maximum size is 5MB.');
      return;
    }
    setEditImageError('');
    setEditImageFile(file);
    setEditImageRemoved(false);
    if (editImagePreview) URL.revokeObjectURL(editImagePreview);
    setEditImagePreview(URL.createObjectURL(file));
  };

  const handleRemoveEditImage = () => {
    if (editImagePreview) URL.revokeObjectURL(editImagePreview);
    setEditImageFile(null);
    setEditImagePreview('');
    setEditImageRemoved(true);
    setEditImageError('');
  };

  const handleOpenEditModal = (p) => {
    setProductToEdit({ ...p, taxRate: p.taxRate ?? 18, stock: p.stock ?? 0 });
    setEditImageFile(null);
    setEditImagePreview('');
    setEditImageRemoved(false);
    setEditImageError('');
  };

  const handleCreateProduct = async (e) => {
    e.preventDefault();
    if (!productForm.sku?.trim() || !productForm.name?.trim()) {
      showToast('Validation Error', 'SKU code and product name are required', 'danger');
      return;
    }

    if (!productForm.category?.trim()) {
      showToast('Validation Error', 'Please select a category. If no categories exist, create one in the Categories tab first.', 'danger');
      return;
    }

    const sPrice = parseFloat(productForm.sellingPrice) || 0;
    const pPrice = parseFloat(productForm.purchasePrice) || 0;
    if (sPrice < 0 || pPrice < 0) {
      showToast('Validation Error', 'Selling and purchase rates cannot be negative', 'danger');
      return;
    }

    setIsSavingProduct(true);
    try {
      let payload;
      if (productImageFile) {
        const fd = new FormData();
        fd.append('sku', productForm.sku.trim().toUpperCase());
        fd.append('name', productForm.name.trim());
        fd.append('description', productForm.description?.trim() || '');
        fd.append('category', productForm.category.trim());
        fd.append('uom', productForm.uom || 'PCS');
        fd.append('sellingPrice', sPrice);
        fd.append('purchasePrice', pPrice);
        fd.append('taxRate', productForm.taxRate !== undefined && productForm.taxRate !== '' ? productForm.taxRate : 18);
        fd.append('stock', productForm.stock !== undefined && productForm.stock !== '' ? productForm.stock : 0);
        fd.append('status', productForm.status || 'ACTIVE');
        fd.append('image', productImageFile);
        payload = fd;
      } else {
        payload = {
          ...productForm,
          sku: productForm.sku.trim().toUpperCase(),
          name: productForm.name.trim(),
          sellingPrice: sPrice,
          purchasePrice: pPrice,
          taxRate: productForm.taxRate !== undefined && productForm.taxRate !== '' ? parseFloat(productForm.taxRate) : 18,
          stock: productForm.stock !== undefined && productForm.stock !== '' ? parseInt(productForm.stock, 10) : 0,
        };
      }
      const res = await api.post(`/companies/${activeCompany.id}/products`, payload);
      setProducts([res.data, ...products]);
      setShowAddProductModal(false);
      handleRemoveCreateImage();
      setProductForm({
        sku: '',
        name: '',
        description: '',
        category: categories[0]?.name || '',
        uom: 'PCS',
        sellingPrice: '',
        purchasePrice: '',
        taxRate: '18',
        stock: '',
        status: 'ACTIVE',
      });
      showToast('Product Registered! 📦', `"${res.data.name}" added to company catalogue.`, 'success');
      // Invalidate related tabs
      loadCategories();
      loadPricings();
    } catch (err) {
      showToast('Product Not Registered', err.message || 'Could not register product.', 'danger');
    } finally {
      setIsSavingProduct(false);
    }
  };

  const handleUpdateProduct = async (e) => {
    e.preventDefault();
    if (!productToEdit) return;
    if (!productToEdit.name?.trim()) {
      showToast('Validation Error', 'Product name is required', 'danger');
      return;
    }

    const sPrice = parseFloat(productToEdit.sellingPrice) || 0;
    const pPrice = parseFloat(productToEdit.purchasePrice) || 0;
    if (sPrice < 0 || pPrice < 0) {
      showToast('Validation Error', 'Rates cannot be negative', 'danger');
      return;
    }

    setIsUpdatingProduct(true);
    try {
      let payload;
      if (editImageFile) {
        const fd = new FormData();
        fd.append('name', productToEdit.name.trim());
        fd.append('description', productToEdit.description || '');
        fd.append('category', productToEdit.category);
        fd.append('uom', productToEdit.uom);
        fd.append('sellingPrice', sPrice);
        fd.append('purchasePrice', pPrice);
        fd.append('taxRate', productToEdit.taxRate !== undefined && productToEdit.taxRate !== '' ? productToEdit.taxRate : 18);
        fd.append('stock', productToEdit.stock !== undefined && productToEdit.stock !== '' ? productToEdit.stock : 0);
        fd.append('status', productToEdit.status);
        fd.append('image', editImageFile);
        payload = fd;
      } else {
        payload = {
          name: productToEdit.name.trim(),
          description: productToEdit.description || '',
          category: productToEdit.category,
          uom: productToEdit.uom,
          sellingPrice: sPrice,
          purchasePrice: pPrice,
          taxRate: productToEdit.taxRate !== undefined && productToEdit.taxRate !== '' ? parseFloat(productToEdit.taxRate) : 18,
          stock: productToEdit.stock !== undefined && productToEdit.stock !== '' ? parseInt(productToEdit.stock, 10) : 0,
          status: productToEdit.status,
        };
        if (editImageRemoved) {
          payload.removeImage = true;
        }
      }
      const res = await api.patch(`/companies/${activeCompany.id}/products/${productToEdit.id}`, payload);
      setProducts(products.map((p) => (p.id === productToEdit.id ? res.data : p)));
      setProductToEdit(null);
      handleRemoveEditImage();
      showToast('Product Updated! 📦', `"${res.data.name}" updated successfully.`, 'success');
      loadCategories();
      loadPricings();
    } catch (err) {
      showToast('Update Failed', err.message || 'Could not update product.', 'danger');
    } finally {
      setIsUpdatingProduct(false);
    }
  };

  const handleDeleteProduct = async () => {
    if (!productToDelete) return;
    try {
      await api.delete(`/companies/${activeCompany.id}/products/${productToDelete.id}`);
      setProducts(products.filter((p) => p.id !== productToDelete.id));
      showToast('Product Removed', `Product "${productToDelete.sku}" removed from catalogue.`, 'danger');
      loadCategories();
      loadPricings();
    } catch (err) {
      showToast('Error', err.message || 'Could not delete product.', 'danger');
    } finally {
      setProductToDelete(null);
    }
  };

  const filteredProducts = (products || []).filter((p) => {
    if (!p) return false;
    const q = (productSearch || '').toLowerCase().trim();
    const matchesSearch =
      !q ||
      String(p.sku || '').toLowerCase().includes(q) ||
      String(p.name || '').toLowerCase().includes(q);
    const matchesCategory = categoryFilter === 'ALL' || p.category === categoryFilter;
    const matchesStatus = statusFilter === 'ALL' || p.status === statusFilter;
    return matchesSearch && matchesCategory && matchesStatus;
  });

  // ---------------------------------------------------------------------------
  // TAB 2: CATEGORIES STATE & HANDLERS
  // ---------------------------------------------------------------------------
  const [categorySearch, setCategorySearch] = useState('');
  const [showAddCategoryModal, setShowAddCategoryModal] = useState(false);
  const [categoryForm, setCategoryForm] = useState({ name: '', description: '' });
  const [isSavingCategory, setIsSavingCategory] = useState(false);

  const [categoryToEdit, setCategoryToEdit] = useState(null);
  const [isUpdatingCategory, setIsUpdatingCategory] = useState(false);
  const [categoryToDelete, setCategoryToDelete] = useState(null);
  const [categoryDeleteBlocked, setCategoryDeleteBlocked] = useState(null);

  const handleCreateCategory = async (e) => {
    e.preventDefault();
    if (!categoryForm.name?.trim()) {
      showToast('Validation Error', 'Category name is required', 'danger');
      return;
    }
    setIsSavingCategory(true);
    try {
      const res = await api.post(`/companies/${activeCompany.id}/products/categories`, {
        name: categoryForm.name.trim(),
        description: categoryForm.description?.trim() || '',
      });
      setCategories([...categories, { ...res.data, productCount: 0 }]);
      setShowAddCategoryModal(false);
      setCategoryForm({ name: '', description: '' });
      showToast('Category Created! 🏷️', `Category "${res.data.name}" added to master taxonomy.`, 'success');
      loadProducts();
    } catch (err) {
      showToast('Error', err.message || 'Could not create category.', 'danger');
    } finally {
      setIsSavingCategory(false);
    }
  };

  const handleUpdateCategory = async (e) => {
    e.preventDefault();
    if (!categoryToEdit || !categoryToEdit.name?.trim()) return;
    setIsUpdatingCategory(true);
    try {
      const res = await api.patch(
        `/companies/${activeCompany.id}/products/categories/${categoryToEdit.id}`,
        {
          name: categoryToEdit.name.trim(),
          description: categoryToEdit.description?.trim() || '',
        }
      );
      setCategories(
        categories.map((c) =>
          c.id === categoryToEdit.id ? { ...res.data, productCount: c.productCount } : c
        )
      );
      setCategoryToEdit(null);
      showToast('Category Updated! 🏷️', `Category "${res.data.name}" updated.`, 'success');
      loadProducts();
    } catch (err) {
      showToast('Update Failed', err.message || 'Could not update category.', 'danger');
    } finally {
      setIsUpdatingCategory(false);
    }
  };

  const handleDeleteCategoryPrompt = (category) => {
    if (category.productCount > 0) {
      setCategoryDeleteBlocked(category);
    } else {
      setCategoryToDelete(category);
    }
  };

  const handleDeleteCategory = async () => {
    if (!categoryToDelete) return;
    try {
      await api.delete(`/companies/${activeCompany.id}/products/categories/${categoryToDelete.id}`);
      setCategories(categories.filter((c) => c.id !== categoryToDelete.id));
      showToast('Category Removed', `Category "${categoryToDelete.name}" removed.`, 'danger');
    } catch (err) {
      showToast('Error', err.message || 'Could not delete category.', 'danger');
    } finally {
      setCategoryToDelete(null);
    }
  };

  const filteredCategories = (categories || []).filter((c) => {
    if (!c) return false;
    const q = (categorySearch || '').toLowerCase().trim();
    return !q || String(c.name || '').toLowerCase().includes(q) || String(c.description || '').toLowerCase().includes(q);
  });

  // ---------------------------------------------------------------------------
  // TAB 3: PRICING & PLANS STATE & HANDLERS
  // ---------------------------------------------------------------------------
  const [pricingSearch, setPricingSearch] = useState('');
  const [pricingProductFilter, setPricingProductFilter] = useState('ALL');
  const [pricingStatusFilter, setPricingStatusFilter] = useState('ALL');

  const [showAddPricingModal, setShowAddPricingModal] = useState(false);
  const [isSavingPricing, setIsSavingPricing] = useState(false);
  const [pricingForm, setPricingForm] = useState({
    productId: '',
    planName: 'Wholesale Tier',
    sellingPrice: '',
    purchasePrice: '',
    taxRate: '18',
    discountRate: '0',
    validFrom: '',
    validUntil: '',
    isDefault: false,
    status: 'ACTIVE',
  });

  const [pricingToEdit, setPricingToEdit] = useState(null);
  const [isUpdatingPricing, setIsUpdatingPricing] = useState(false);
  const [pricingToDelete, setPricingToDelete] = useState(null);

  const handleCreatePricing = async (e) => {
    e.preventDefault();
    if (!pricingForm.productId) {
      showToast('Validation Error', 'Please select an existing product from catalogue', 'danger');
      return;
    }
    if (!pricingForm.planName?.trim()) {
      showToast('Validation Error', 'Plan name is required', 'danger');
      return;
    }

    const sPrice = parseFloat(pricingForm.sellingPrice) || 0;
    const pPrice = parseFloat(pricingForm.purchasePrice) || 0;
    const tax = parseFloat(pricingForm.taxRate) || 0;
    const discount = parseFloat(pricingForm.discountRate) || 0;

    if (sPrice < 0 || pPrice < 0) {
      showToast('Validation Error', 'Rates cannot be negative', 'danger');
      return;
    }
    if (tax < 0 || tax > 100 || discount < 0 || discount > 100) {
      showToast('Validation Error', 'Tax and discount rates must be between 0 and 100%', 'danger');
      return;
    }

    setIsSavingPricing(true);
    try {
      const res = await api.post(`/companies/${activeCompany.id}/products/pricing`, {
        ...pricingForm,
        sellingPrice: sPrice,
        purchasePrice: pPrice,
        taxRate: tax,
        discountRate: discount,
      });
      setPricings([res.data, ...pricings]);
      setShowAddPricingModal(false);
      setPricingForm({
        productId: products[0]?.id || '',
        planName: 'Wholesale Tier',
        sellingPrice: '',
        purchasePrice: '',
        taxRate: '18',
        discountRate: '0',
        validFrom: '',
        validUntil: '',
        isDefault: false,
        status: 'ACTIVE',
      });
      showToast('Pricing Plan Added! 💰', `Plan "${res.data.planName}" configured for product.`, 'success');
      loadProducts();
    } catch (err) {
      showToast('Error', err.message || 'Could not configure pricing plan.', 'danger');
    } finally {
      setIsSavingPricing(false);
    }
  };

  const handleUpdatePricing = async (e) => {
    e.preventDefault();
    if (!pricingToEdit) return;

    const sPrice = parseFloat(pricingToEdit.sellingPrice) || 0;
    const pPrice = parseFloat(pricingToEdit.purchasePrice) || 0;
    const tax = parseFloat(pricingToEdit.taxRate) || 0;
    const discount = parseFloat(pricingToEdit.discountRate) || 0;

    if (sPrice < 0 || pPrice < 0) {
      showToast('Validation Error', 'Rates cannot be negative', 'danger');
      return;
    }
    if (tax < 0 || tax > 100 || discount < 0 || discount > 100) {
      showToast('Validation Error', 'Tax and discount rates must be between 0 and 100%', 'danger');
      return;
    }

    setIsUpdatingPricing(true);
    try {
      const res = await api.patch(
        `/companies/${activeCompany.id}/products/pricing/${pricingToEdit.id}`,
        {
          planName: pricingToEdit.planName,
          sellingPrice: sPrice,
          purchasePrice: pPrice,
          taxRate: tax,
          discountRate: discount,
          validFrom: pricingToEdit.validFrom || null,
          validUntil: pricingToEdit.validUntil || null,
          isDefault: Boolean(pricingToEdit.isDefault),
          status: pricingToEdit.status,
        }
      );
      setPricings(pricings.map((pr) => (pr.id === pricingToEdit.id ? res.data : pr)));
      setPricingToEdit(null);
      showToast('Pricing Plan Updated! 💰', `Plan "${res.data.planName}" updated.`, 'success');
      loadProducts();
    } catch (err) {
      showToast('Update Failed', err.message || 'Could not update pricing plan.', 'danger');
    } finally {
      setIsUpdatingPricing(false);
    }
  };

  const handleDeletePricing = async () => {
    if (!pricingToDelete) return;
    try {
      await api.delete(`/companies/${activeCompany.id}/products/pricing/${pricingToDelete.id}`);
      setPricings(pricings.filter((pr) => pr.id !== pricingToDelete.id));
      showToast('Price Plan Removed', 'Pricing configuration removed.', 'danger');
      loadProducts();
    } catch (err) {
      showToast('Error', err.message || 'Could not delete pricing.', 'danger');
    } finally {
      setPricingToDelete(null);
    }
  };

  const filteredPricings = (pricings || []).filter((pr) => {
    if (!pr) return false;
    const q = (pricingSearch || '').toLowerCase().trim();
    const matchesSearch =
      !q ||
      String(pr.planName || '').toLowerCase().includes(q) ||
      String(pr.product?.name || '').toLowerCase().includes(q) ||
      String(pr.product?.sku || '').toLowerCase().includes(q);
    const matchesProduct = pricingProductFilter === 'ALL' || pr.productId === pricingProductFilter;
    const matchesStatus = pricingStatusFilter === 'ALL' || pr.status === pricingStatusFilter;
    return matchesSearch && matchesProduct && matchesStatus;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#0f172a' }}>
            Product Catalogue &amp; Master SKUs
          </h2>
          <p style={{ fontSize: '0.85rem', color: '#64748b' }}>
            Catalogued materials, categories, and price schedules registered for {activeCompany?.organizationName}
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {activeTab === 'all' && (
            <button
              type="button"
              onClick={() => {
                setProductForm({
                  sku: '',
                  name: '',
                  description: '',
                  category: categories[0]?.name || '',
                  uom: 'PCS',
                  sellingPrice: '',
                  purchasePrice: '',
                  status: 'ACTIVE',
                });
                setShowAddProductModal(true);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.65rem 1.25rem',
                background: '#7f22fe',
                color: '#ffffff',
                borderRadius: '8px',
                fontWeight: 700,
                fontSize: '0.86rem',
                border: 'none',
                cursor: 'pointer',
                boxShadow: '0 4px 6px rgba(127, 34, 254, 0.25)',
              }}
            >
              <IconPlus size={16} /> Register New SKU
            </button>
          )}

          {activeTab === 'categories' && (
            <button
              type="button"
              onClick={() => {
                setCategoryForm({ name: '', description: '' });
                setShowAddCategoryModal(true);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.65rem 1.25rem',
                background: '#7f22fe',
                color: '#ffffff',
                borderRadius: '8px',
                fontWeight: 700,
                fontSize: '0.86rem',
                border: 'none',
                cursor: 'pointer',
                boxShadow: '0 4px 6px rgba(127, 34, 254, 0.25)',
              }}
            >
              <IconPlus size={16} /> Add Category
            </button>
          )}

          {activeTab === 'pricing' && (
            <button
              type="button"
              onClick={() => {
                setPricingForm({
                  productId: products[0]?.id || '',
                  planName: 'Wholesale Tier',
                  sellingPrice: '',
                  purchasePrice: '',
                  taxRate: '18',
                  discountRate: '0',
                  validFrom: '',
                  validUntil: '',
                  isDefault: false,
                  status: 'ACTIVE',
                });
                setShowAddPricingModal(true);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.65rem 1.25rem',
                background: '#7f22fe',
                color: '#ffffff',
                borderRadius: '8px',
                fontWeight: 700,
                fontSize: '0.86rem',
                border: 'none',
                cursor: 'pointer',
                boxShadow: '0 4px 6px rgba(127, 34, 254, 0.25)',
              }}
            >
              <IconPlus size={16} /> Configure Price Plan
            </button>
          )}
        </div>
      </div>

      {/* Module Navigation Tabs — 3 Clean Tabs (Department Head removed) */}
      <div style={{ display: 'flex', borderBottom: '1px solid #e2e8f0', gap: '0.5rem', flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={() => handleTabChange('all')}
          style={{
            padding: '0.65rem 1.25rem',
            fontWeight: activeTab === 'all' ? 800 : 600,
            color: activeTab === 'all' ? '#7f22fe' : '#64748b',
            borderBottom: activeTab === 'all' ? '2px solid #7f22fe' : '2px solid transparent',
            background: 'transparent',
            borderTop: 'none',
            borderLeft: 'none',
            borderRight: 'none',
            fontSize: '0.88rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
          }}
        >
          <IconPackage size={16} />
          Product Directory ({products.length})
        </button>

        <button
          type="button"
          onClick={() => handleTabChange('categories')}
          style={{
            padding: '0.65rem 1.25rem',
            fontWeight: activeTab === 'categories' ? 800 : 600,
            color: activeTab === 'categories' ? '#7f22fe' : '#64748b',
            borderBottom: activeTab === 'categories' ? '2px solid #7f22fe' : '2px solid transparent',
            background: 'transparent',
            borderTop: 'none',
            borderLeft: 'none',
            borderRight: 'none',
            fontSize: '0.88rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
          }}
        >
          <IconLayers size={16} />
          Categories ({categories.length})
        </button>

        <button
          type="button"
          onClick={() => handleTabChange('pricing')}
          style={{
            padding: '0.65rem 1.25rem',
            fontWeight: activeTab === 'pricing' ? 800 : 600,
            color: activeTab === 'pricing' ? '#7f22fe' : '#64748b',
            borderBottom: activeTab === 'pricing' ? '2px solid #7f22fe' : '2px solid transparent',
            background: 'transparent',
            borderTop: 'none',
            borderLeft: 'none',
            borderRight: 'none',
            fontSize: '0.88rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
          }}
        >
          <IconCreditCard size={16} />
          Pricing &amp; Plans ({pricings.length})
        </button>
      </div>

      {/* =================================================================== */}
      {/* TAB 1: PRODUCT DIRECTORY                                            */}
      {/* =================================================================== */}
      {activeTab === 'all' && (
        <div style={{ background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
          {/* Filter Bar */}
          <div
            style={{
              padding: '1rem 1.25rem',
              borderBottom: '1px solid #f1f5f9',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '1rem',
              flexWrap: 'wrap',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flex: 1, minWidth: '220px' }}>
              <input
                type="text"
                placeholder="Search by SKU code or product title..."
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                style={{
                  width: '100%',
                  maxWidth: '360px',
                  padding: '0.5rem 0.85rem',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  fontSize: '0.84rem',
                }}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>Category:</span>
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  style={{
                    padding: '0.45rem 0.75rem',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.82rem',
                    background: '#ffffff',
                  }}
                >
                  <option value="ALL">All Categories</option>
                  {categories.map((c) => (
                    <option key={c.id || c.name} value={c.name}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>Status:</span>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  style={{
                    padding: '0.45rem 0.75rem',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.82rem',
                    background: '#ffffff',
                  }}
                >
                  <option value="ALL">All Status</option>
                  <option value="ACTIVE">Active</option>
                  <option value="INACTIVE">Inactive</option>
                </select>
              </div>

              <button
                type="button"
                onClick={loadProducts}
                title="Refresh Product List"
                style={{
                  padding: '0.45rem 0.65rem',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  background: '#f8fafc',
                  color: '#475569',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                <IconRefreshCw size={14} />
              </button>
            </div>
          </div>

          {/* Table */}
          {isLoadingProducts ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: '#64748b', fontSize: '0.88rem' }}>
              Loading company product catalogue...
            </div>
          ) : filteredProducts.length === 0 ? (
            <EmptyState
              icon="📦"
              title="No Products Found"
              description="No product matches your query. Register products to begin creating quotes and stock receipts."
              actionLabel="Register Product"
              onAction={() => setShowAddProductModal(true)}
            />
          ) : (
            <div style={{ overflowX: 'auto', width: '100%', WebkitOverflowScrolling: 'touch' }}>
              <table style={{ width: '100%', minWidth: '1040px', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontWeight: 700, whiteSpace: 'nowrap' }}>
                    <th style={{ padding: '0.85rem 0.75rem', width: '56px', whiteSpace: 'nowrap' }}>Photo</th>
                    <th style={{ padding: '0.85rem 1.25rem', whiteSpace: 'nowrap' }}>SKU Code</th>
                    <th style={{ padding: '0.85rem 1rem', whiteSpace: 'nowrap' }}>Product Name</th>
                    <th style={{ padding: '0.85rem 1rem', whiteSpace: 'nowrap' }}>Category</th>
                    <th style={{ padding: '0.85rem 1rem', whiteSpace: 'nowrap' }}>UOM</th>
                    <th style={{ padding: '0.85rem 1rem', whiteSpace: 'nowrap' }}>Selling Rate</th>
                    <th style={{ padding: '0.85rem 1rem', whiteSpace: 'nowrap' }}>Purchase Rate</th>
                    <th style={{ padding: '0.85rem 1rem', whiteSpace: 'nowrap' }}>GST (%)</th>
                    <th style={{ padding: '0.85rem 1rem', whiteSpace: 'nowrap' }}>Available Stock</th>
                    <th style={{ padding: '0.85rem 1rem', whiteSpace: 'nowrap' }}>Status</th>
                    <th style={{ padding: '0.85rem 1.25rem', textAlign: 'right', whiteSpace: 'nowrap' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProducts.map((p) => (
                    <tr key={p.id} style={{ borderBottom: '1px solid #f1f5f9', whiteSpace: 'nowrap' }}>
                      <td style={{ padding: '0.65rem 0.75rem', width: '56px' }}>
                        <ProductThumbnail
                          product={p}
                          companyId={activeCompany?.id}
                          size={42}
                          onEnlarge={(url) => setImageToEnlarge({ url, title: p.name, sku: p.sku })}
                        />
                      </td>
                      <td style={{ padding: '0.85rem 1.25rem', fontWeight: 800, color: '#7f22fe', whiteSpace: 'nowrap' }}>
                        {p.sku}
                      </td>
                      <td style={{ padding: '0.85rem 1rem', whiteSpace: 'nowrap' }}>
                        <div style={{ fontWeight: 700, color: '#0f172a', whiteSpace: 'nowrap' }}>{p.name}</div>
                        {p.description && (
                          <div style={{ fontSize: '0.74rem', color: '#64748b', maxWidth: '280px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {p.description}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '0.85rem 1rem', whiteSpace: 'nowrap' }}>
                        <span style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '0.74rem', fontWeight: 600, background: '#f1f5f9', color: '#334155', whiteSpace: 'nowrap' }}>
                          {p.category}
                        </span>
                      </td>
                      <td style={{ padding: '0.85rem 1rem', fontWeight: 600, color: '#64748b', whiteSpace: 'nowrap' }}>
                        {p.uom}
                      </td>
                      <td style={{ padding: '0.85rem 1rem', fontWeight: 700, color: '#0f172a', whiteSpace: 'nowrap' }}>
                        ₹ {Number(p.sellingPrice || 0).toFixed(2)}
                      </td>
                      <td style={{ padding: '0.85rem 1rem', color: '#64748b', whiteSpace: 'nowrap' }}>
                        ₹ {Number(p.purchasePrice || 0).toFixed(2)}
                      </td>
                      <td style={{ padding: '0.85rem 1rem', whiteSpace: 'nowrap' }}>
                        <span style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '0.74rem', fontWeight: 700, background: '#e0e7ff', color: '#3730a3', whiteSpace: 'nowrap' }}>
                          {Number(p.taxRate ?? 18).toFixed(1)}%
                        </span>
                      </td>
                      <td style={{ padding: '0.85rem 1rem', whiteSpace: 'nowrap' }}>
                        <span
                          style={{
                            fontWeight: 800,
                            color: Number(p.stock || 0) < 20 ? '#ef4444' : '#10b981',
                            whiteSpace: 'nowrap',
                          }}
                          title="Actual quantity sourced from Inventory & Warehouse stock records"
                        >
                          {p.stock ?? 0} {p.uom}
                        </span>
                        {Number(p.stock || 0) < 20 && (
                          <span style={{ marginLeft: '6px', fontSize: '0.68rem', background: '#fef2f2', color: '#b91c1c', padding: '1px 5px', borderRadius: '3px', fontWeight: 700, whiteSpace: 'nowrap' }}>
                            LOW
                          </span>
                        )}
                      </td>
                      <td style={{ padding: '0.85rem 1rem', whiteSpace: 'nowrap' }}>
                        <span
                          style={{
                            padding: '2px 8px',
                            borderRadius: '4px',
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            background: p.status === 'ACTIVE' ? '#ecfdf5' : '#f1f5f9',
                            color: p.status === 'ACTIVE' ? '#047857' : '#64748b',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {p.status || 'ACTIVE'}
                        </span>
                      </td>
                      <td style={{ padding: '0.85rem 1.25rem', textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'inline-flex', gap: '0.4rem', whiteSpace: 'nowrap' }}>
                          <button
                            type="button"
                            onClick={() => setProductToView(p)}
                            style={{
                              padding: '4px 8px',
                              borderRadius: '4px',
                              color: '#334155',
                              fontSize: '0.75rem',
                              fontWeight: 600,
                              background: '#f8fafc',
                              border: '1px solid #cbd5e1',
                              cursor: 'pointer',
                            }}
                          >
                            View
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenEditModal(p)}
                            style={{
                              padding: '4px 8px',
                              borderRadius: '4px',
                              color: '#4338ca',
                              fontSize: '0.75rem',
                              fontWeight: 600,
                              background: '#eef2ff',
                              border: '1px solid #c7d2fe',
                              cursor: 'pointer',
                            }}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => setProductToDelete(p)}
                            style={{
                              padding: '4px 8px',
                              borderRadius: '4px',
                              color: '#dc2626',
                              fontSize: '0.75rem',
                              fontWeight: 600,
                              background: '#fef2f2',
                              border: '1px solid #fecaca',
                              cursor: 'pointer',
                            }}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* =================================================================== */}
      {/* TAB 2: CATEGORIES                                                   */}
      {/* =================================================================== */}
      {activeTab === 'categories' && (
        <div style={{ background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
          {/* Header Bar */}
          <div
            style={{
              padding: '1rem 1.25rem',
              borderBottom: '1px solid #f1f5f9',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '1rem',
              flexWrap: 'wrap',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flex: 1, minWidth: '220px' }}>
              <input
                type="text"
                placeholder="Search categories..."
                value={categorySearch}
                onChange={(e) => setCategorySearch(e.target.value)}
                style={{
                  width: '100%',
                  maxWidth: '360px',
                  padding: '0.5rem 0.85rem',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  fontSize: '0.84rem',
                }}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <span style={{ fontSize: '0.82rem', color: '#64748b' }}>
                Total Categories: <strong>{categories.length}</strong>
              </span>
              <button
                type="button"
                onClick={loadCategories}
                title="Refresh Categories"
                style={{
                  padding: '0.45rem 0.65rem',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  background: '#f8fafc',
                  color: '#475569',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                <IconRefreshCw size={14} />
              </button>
            </div>
          </div>

          {isLoadingCategories ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: '#64748b', fontSize: '0.88rem' }}>
              Loading product categories...
            </div>
          ) : filteredCategories.length === 0 ? (
            <EmptyState
              icon="🏷️"
              title="No Categories Configured"
              description="Categories help structure your inventory and catalogue. Add categories to organize materials and finished goods."
              actionLabel="Add Category"
              onAction={() => {
                setCategoryForm({ name: '', description: '' });
                setShowAddCategoryModal(true);
              }}
            />
          ) : (
            <div style={{ overflowX: 'auto', width: '100%', WebkitOverflowScrolling: 'touch' }}>
              <table style={{ width: '100%', minWidth: '760px', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontWeight: 700, whiteSpace: 'nowrap' }}>
                    <th style={{ padding: '0.85rem 1.25rem', whiteSpace: 'nowrap' }}>Category Name</th>
                    <th style={{ padding: '0.85rem 1rem', whiteSpace: 'nowrap' }}>Description</th>
                    <th style={{ padding: '0.85rem 1rem', whiteSpace: 'nowrap' }}>Linked Products</th>
                    <th style={{ padding: '0.85rem 1rem', whiteSpace: 'nowrap' }}>Created Date</th>
                    <th style={{ padding: '0.85rem 1.25rem', textAlign: 'right', whiteSpace: 'nowrap' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCategories.map((c) => (
                    <tr key={c.id || c.name} style={{ borderBottom: '1px solid #f1f5f9', whiteSpace: 'nowrap' }}>
                      <td style={{ padding: '0.85rem 1.25rem', fontWeight: 800, color: '#0f172a', whiteSpace: 'nowrap' }}>
                        {c.name}
                      </td>
                      <td style={{ padding: '0.85rem 1rem', color: '#64748b', whiteSpace: 'nowrap' }}>
                        {c.description || '—'}
                      </td>
                      <td style={{ padding: '0.85rem 1rem', whiteSpace: 'nowrap' }}>
                        <span
                          style={{
                            padding: '3px 9px',
                            borderRadius: '12px',
                            fontSize: '0.74rem',
                            fontWeight: 700,
                            background: c.productCount > 0 ? '#eff6ff' : '#f8fafc',
                            color: c.productCount > 0 ? '#1d4ed8' : '#64748b',
                            border: '1px solid #e2e8f0',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {c.productCount || 0} Products Linked
                        </span>
                      </td>
                      <td style={{ padding: '0.85rem 1rem', color: '#64748b', fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                        {c.createdAt ? new Date(c.createdAt).toLocaleDateString() : '—'}
                      </td>
                      <td style={{ padding: '0.85rem 1.25rem', textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'inline-flex', gap: '0.4rem', whiteSpace: 'nowrap' }}>
                          <button
                            type="button"
                            onClick={() => setCategoryToEdit({ ...c })}
                            style={{
                              padding: '4px 8px',
                              borderRadius: '4px',
                              color: '#4338ca',
                              fontSize: '0.75rem',
                              fontWeight: 600,
                              background: '#eef2ff',
                              border: '1px solid #c7d2fe',
                              cursor: 'pointer',
                            }}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteCategoryPrompt(c)}
                            style={{
                              padding: '4px 8px',
                              borderRadius: '4px',
                              color: '#dc2626',
                              fontSize: '0.75rem',
                              fontWeight: 600,
                              background: '#fef2f2',
                              border: '1px solid #fecaca',
                              cursor: 'pointer',
                            }}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* =================================================================== */}
      {/* TAB 3: PRICING & PLANS                                              */}
      {/* =================================================================== */}
      {activeTab === 'pricing' && (
        <div style={{ background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
          {/* Header Bar */}
          <div
            style={{
              padding: '1rem 1.25rem',
              borderBottom: '1px solid #f1f5f9',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '1rem',
              flexWrap: 'wrap',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flex: 1, minWidth: '220px' }}>
              <input
                type="text"
                placeholder="Search price plans, SKU or product title..."
                value={pricingSearch}
                onChange={(e) => setPricingSearch(e.target.value)}
                style={{
                  width: '100%',
                  maxWidth: '360px',
                  padding: '0.5rem 0.85rem',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  fontSize: '0.84rem',
                }}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>Product:</span>
                <select
                  value={pricingProductFilter}
                  onChange={(e) => setPricingProductFilter(e.target.value)}
                  style={{
                    padding: '0.45rem 0.75rem',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.82rem',
                    background: '#ffffff',
                    maxWidth: '180px',
                  }}
                >
                  <option value="ALL">All Products</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.sku} — {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>Status:</span>
                <select
                  value={pricingStatusFilter}
                  onChange={(e) => setPricingStatusFilter(e.target.value)}
                  style={{
                    padding: '0.45rem 0.75rem',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.82rem',
                    background: '#ffffff',
                  }}
                >
                  <option value="ALL">All Status</option>
                  <option value="ACTIVE">Active</option>
                  <option value="INACTIVE">Inactive</option>
                </select>
              </div>

              <button
                type="button"
                onClick={loadPricings}
                title="Refresh Price Plans"
                style={{
                  padding: '0.45rem 0.65rem',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  background: '#f8fafc',
                  color: '#475569',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                <IconRefreshCw size={14} />
              </button>
            </div>
          </div>

          {isLoadingPricings ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: '#64748b', fontSize: '0.88rem' }}>
              Loading product pricing configurations...
            </div>
          ) : filteredPricings.length === 0 ? (
            <EmptyState
              icon="💳"
              title="No Price Plans Configured"
              description="Configure standard rates, wholesale tiers, and discount schedules for your existing catalogue products."
              actionLabel="Configure Price Plan"
              onAction={() => {
                setPricingForm({
                  productId: products[0]?.id || '',
                  planName: 'Wholesale Tier',
                  sellingPrice: '',
                  purchasePrice: '',
                  taxRate: '18',
                  discountRate: '0',
                  validFrom: '',
                  validUntil: '',
                  isDefault: false,
                  status: 'ACTIVE',
                });
                setShowAddPricingModal(true);
              }}
            />
          ) : (
            <div style={{ overflowX: 'auto', width: '100%', WebkitOverflowScrolling: 'touch' }}>
              <table style={{ width: '100%', minWidth: '1050px', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontWeight: 700, whiteSpace: 'nowrap' }}>
                    <th style={{ padding: '0.85rem 1.25rem', whiteSpace: 'nowrap' }}>Product / SKU</th>
                    <th style={{ padding: '0.85rem 1rem', whiteSpace: 'nowrap' }}>Plan Tier</th>
                    <th style={{ padding: '0.85rem 1rem', whiteSpace: 'nowrap' }}>Selling Rate</th>
                    <th style={{ padding: '0.85rem 1rem', whiteSpace: 'nowrap' }}>Purchase Rate</th>
                    <th style={{ padding: '0.85rem 1rem', whiteSpace: 'nowrap' }}>Tax (GST)</th>
                    <th style={{ padding: '0.85rem 1rem', whiteSpace: 'nowrap' }}>Discount</th>
                    <th style={{ padding: '0.85rem 1rem', whiteSpace: 'nowrap' }}>Tier Role</th>
                    <th style={{ padding: '0.85rem 1rem', whiteSpace: 'nowrap' }}>Status</th>
                    <th style={{ padding: '0.85rem 1.25rem', textAlign: 'right', whiteSpace: 'nowrap' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPricings.map((pr) => (
                    <tr key={pr.id} style={{ borderBottom: '1px solid #f1f5f9', whiteSpace: 'nowrap' }}>
                      <td style={{ padding: '0.85rem 1.25rem', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                          <ProductThumbnail
                            product={pr.product}
                            companyId={activeCompany?.id}
                            size={36}
                            onEnlarge={(url) => setImageToEnlarge({ url, title: pr.product?.name, sku: pr.product?.sku })}
                          />
                          <div>
                            <div style={{ fontWeight: 800, color: '#7f22fe', whiteSpace: 'nowrap' }}>
                              {pr.product?.sku || 'SKU'}
                            </div>
                            <div style={{ fontWeight: 600, color: '#0f172a', fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                              {pr.product?.name || 'Catalogue Item'}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '0.85rem 1rem', fontWeight: 700, color: '#334155', whiteSpace: 'nowrap' }}>
                        {pr.planName}
                      </td>
                      <td style={{ padding: '0.85rem 1rem', fontWeight: 800, color: '#0f172a', whiteSpace: 'nowrap' }}>
                        ₹ {Number(pr.sellingPrice || 0).toFixed(2)}
                      </td>
                      <td style={{ padding: '0.85rem 1rem', color: '#64748b', whiteSpace: 'nowrap' }}>
                        ₹ {Number(pr.purchasePrice || 0).toFixed(2)}
                      </td>
                      <td style={{ padding: '0.85rem 1rem', color: '#475569', fontWeight: 600, whiteSpace: 'nowrap' }}>
                        {Number(pr.taxRate || 0).toFixed(1)}%
                      </td>
                      <td style={{ padding: '0.85rem 1rem', color: Number(pr.discountRate || 0) > 0 ? '#10b981' : '#64748b', fontWeight: 600, whiteSpace: 'nowrap' }}>
                        {Number(pr.discountRate || 0).toFixed(1)}%
                      </td>
                      <td style={{ padding: '0.85rem 1rem', whiteSpace: 'nowrap' }}>
                        {pr.isDefault ? (
                          <span
                            style={{
                              padding: '2px 8px',
                              borderRadius: '4px',
                              fontSize: '0.72rem',
                              fontWeight: 700,
                              background: '#eff6ff',
                              color: '#1d4ed8',
                              border: '1px solid #bfdbfe',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            Primary Rate
                          </span>
                        ) : (
                          <span style={{ fontSize: '0.74rem', color: '#64748b', whiteSpace: 'nowrap' }}>Special Plan</span>
                        )}
                      </td>
                      <td style={{ padding: '0.85rem 1rem', whiteSpace: 'nowrap' }}>
                        <span
                          style={{
                            padding: '2px 8px',
                            borderRadius: '4px',
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            background: pr.status === 'ACTIVE' ? '#ecfdf5' : '#f1f5f9',
                            color: pr.status === 'ACTIVE' ? '#047857' : '#64748b',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {pr.status || 'ACTIVE'}
                        </span>
                      </td>
                      <td style={{ padding: '0.85rem 1.25rem', textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'inline-flex', gap: '0.4rem', whiteSpace: 'nowrap' }}>
                          <button
                            type="button"
                            onClick={() => setPricingToEdit({ ...pr })}
                            style={{
                              padding: '4px 8px',
                              borderRadius: '4px',
                              color: '#4338ca',
                              fontSize: '0.75rem',
                              fontWeight: 600,
                              background: '#eef2ff',
                              border: '1px solid #c7d2fe',
                              cursor: 'pointer',
                            }}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => setPricingToDelete(pr)}
                            style={{
                              padding: '4px 8px',
                              borderRadius: '4px',
                              color: '#dc2626',
                              fontSize: '0.75rem',
                              fontWeight: 600,
                              background: '#fef2f2',
                              border: '1px solid #fecaca',
                              cursor: 'pointer',
                            }}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* =================================================================== */}
      {/* MODALS: PRODUCT DIRECTORY                                           */}
      {/* =================================================================== */}

      {/* Add Product Modal */}
      <Modal isOpen={showAddProductModal} onClose={() => setShowAddProductModal(false)} title="Register New Catalogue SKU">
        <form onSubmit={handleCreateProduct} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.35rem' }}>
                SKU Code *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. PRD-FIN-501"
                value={productForm.sku}
                onChange={(e) => setProductForm({ ...productForm, sku: e.target.value })}
                style={{ width: '100%', padding: '0.6rem 0.85rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.35rem' }}>
                Category *
              </label>
              {categories.length > 0 ? (
                <select
                  value={productForm.category}
                  onChange={(e) => setProductForm({ ...productForm, category: e.target.value })}
                  style={{ width: '100%', padding: '0.6rem 0.85rem', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#ffffff' }}
                  required
                >
                  <option value="">-- Select Category --</option>
                  {categories.map((c) => (
                    <option key={c.id || c.name} value={c.name}>
                      {c.name}
                    </option>
                  ))}
                </select>
              ) : (
                <div style={{ padding: '0.6rem 0.85rem', background: '#fff7ed', border: '1px solid #fdba74', borderRadius: '6px', fontSize: '0.8rem', color: '#c2410c' }}>
                  <p style={{ margin: '0 0 0.35rem 0', fontWeight: 600 }}>No categories created yet</p>
                  <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.75rem', color: '#9a3412' }}>
                    Create a category first in the Categories tab before registering a product.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddProductModal(false);
                      setActiveTab('categories');
                      setShowAddCategoryModal(true);
                    }}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      padding: '0.35rem 0.75rem',
                      background: '#ea580c',
                      color: '#ffffff',
                      borderRadius: '5px',
                      fontWeight: 600,
                      fontSize: '0.78rem',
                      border: 'none',
                      cursor: 'pointer',
                    }}
                  >
                    <IconPlus size={14} /> + Create Category First
                  </button>
                </div>
              )}
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.35rem' }}>
              Product Title / Name *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Precision CNC Machined Flange 100mm"
              value={productForm.name}
              onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
              style={{ width: '100%', padding: '0.6rem 0.85rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.35rem' }}>
              Description / Specifications (Optional)
            </label>
            <textarea
              rows={2}
              placeholder="e.g. High-tensile stainless steel grade SS304"
              value={productForm.description}
              onChange={(e) => setProductForm({ ...productForm, description: e.target.value })}
              style={{ width: '100%', padding: '0.6rem 0.85rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
            />
          </div>

          {/* Product Image Uploader */}
          <ProductImageUploader
            imageFile={productImageFile}
            imagePreview={productImagePreview}
            currentImageUrl={null}
            onSelectImage={handleSelectCreateImage}
            onRemoveImage={handleRemoveCreateImage}
            errorMessage={productImageError}
          />

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.85rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.35rem' }}>
                Unit of Measure (UOM)
              </label>
              <select
                value={productForm.uom || 'PCS'}
                onChange={(e) => setProductForm({ ...productForm, uom: e.target.value })}
                style={{ width: '100%', padding: '0.6rem 0.85rem', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#ffffff' }}
              >
                <option value="PCS">PCS (Pieces)</option>
                <option value="KG">KG (Kilograms)</option>
                <option value="LTR">LTR (Liters)</option>
                <option value="BOX">BOX (Boxes)</option>
                <option value="MTR">MTR (Meters)</option>
                <option value="SET">SET (Sets)</option>
                <option value="PKT">PKT (Packets)</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.35rem' }}>
                Selling Rate (₹)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={productForm.sellingPrice ?? ''}
                onChange={(e) => setProductForm({ ...productForm, sellingPrice: e.target.value })}
                style={{ width: '100%', padding: '0.6rem 0.85rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.35rem' }}>
                Purchase Rate (₹)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={productForm.purchasePrice ?? ''}
                onChange={(e) => setProductForm({ ...productForm, purchasePrice: e.target.value })}
                style={{ width: '100%', padding: '0.6rem 0.85rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.35rem' }}>
                GST / Tax (%)
              </label>
              <input
                type="number"
                step="0.1"
                min="0"
                max="100"
                placeholder="18"
                value={productForm.taxRate ?? '18'}
                onChange={(e) => setProductForm({ ...productForm, taxRate: e.target.value })}
                style={{ width: '100%', padding: '0.6rem 0.85rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.35rem' }}>
                Opening Stock (Qty)
              </label>
              <input
                type="number"
                min="0"
                placeholder="0"
                value={productForm.stock ?? ''}
                onChange={(e) => setProductForm({ ...productForm, stock: e.target.value })}
                style={{ width: '100%', padding: '0.6rem 0.85rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
              />
            </div>
          </div>

          <div style={{ background: '#f8fafc', padding: '0.75rem', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '0.78rem', color: '#64748b' }}>
            ℹ️ <strong>Stock Information:</strong> Initial stock is not managed here. Material stock levels are recorded and verified directly via the <strong>Inventory &amp; Warehouse</strong> module.
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
            <button
              type="button"
              onClick={() => setShowAddProductModal(false)}
              style={{ padding: '0.6rem 1.25rem', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#ffffff', color: '#475569', fontWeight: 600, cursor: 'pointer' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSavingProduct}
              style={{ padding: '0.6rem 1.35rem', borderRadius: '6px', border: 'none', background: '#7f22fe', color: '#ffffff', fontWeight: 700, cursor: isSavingProduct ? 'not-allowed' : 'pointer' }}
            >
              {isSavingProduct ? 'Registering...' : 'Register SKU'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Edit Product Modal */}
      {productToEdit && (
        <Modal isOpen={Boolean(productToEdit)} onClose={() => setProductToEdit(null)} title={`Edit Product — ${productToEdit.sku}`}>
          <form onSubmit={handleUpdateProduct} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.35rem' }}>
                Product Title / Name *
              </label>
              <input
                type="text"
                required
                value={productToEdit.name}
                onChange={(e) => setProductToEdit({ ...productToEdit, name: e.target.value })}
                style={{ width: '100%', padding: '0.6rem 0.85rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.35rem' }}>
                  Category
                </label>
                <select
                  value={productToEdit.category}
                  onChange={(e) => setProductToEdit({ ...productToEdit, category: e.target.value })}
                  style={{ width: '100%', padding: '0.6rem 0.85rem', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#ffffff' }}
                  required
                >
                  <option value="">-- Select Category --</option>
                  {categories.map((c) => (
                    <option key={c.id || c.name} value={c.name}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.35rem' }}>
                  Status
                </label>
                <select
                  value={productToEdit.status || 'ACTIVE'}
                  onChange={(e) => setProductToEdit({ ...productToEdit, status: e.target.value })}
                  style={{ width: '100%', padding: '0.6rem 0.85rem', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#ffffff' }}
                >
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="INACTIVE">INACTIVE</option>
                </select>
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.35rem' }}>
                Description
              </label>
              <textarea
                rows={2}
                value={productToEdit.description || ''}
                onChange={(e) => setProductToEdit({ ...productToEdit, description: e.target.value })}
                style={{ width: '100%', padding: '0.6rem 0.85rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
              />
            </div>

            {/* Product Image Uploader */}
            <ProductImageUploader
              imageFile={editImageFile}
              imagePreview={editImagePreview}
              currentImageUrl={productToEdit ? getProductImageUrl(productToEdit.imageUrl, activeCompany?.id, productToEdit.id) : null}
              onSelectImage={handleSelectEditImage}
              onRemoveImage={handleRemoveEditImage}
              errorMessage={editImageError}
              isRemoved={editImageRemoved}
            />

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.35rem' }}>
                  UOM
                </label>
                <select
                  value={productToEdit.uom}
                  onChange={(e) => setProductToEdit({ ...productToEdit, uom: e.target.value })}
                  style={{ width: '100%', padding: '0.6rem 0.85rem', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#ffffff' }}
                >
                  <option value="PCS">PCS</option>
                  <option value="KG">KG</option>
                  <option value="LTR">LTR</option>
                  <option value="BOX">BOX</option>
                  <option value="MTR">MTR</option>
                  <option value="SET">SET</option>
                  <option value="PKT">PKT</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.35rem' }}>
                  Selling Rate (₹)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={productToEdit.sellingPrice}
                  onChange={(e) => setProductToEdit({ ...productToEdit, sellingPrice: e.target.value })}
                  style={{ width: '100%', padding: '0.6rem 0.85rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.35rem' }}>
                  Purchase Rate (₹)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={productToEdit.purchasePrice}
                  onChange={(e) => setProductToEdit({ ...productToEdit, purchasePrice: e.target.value })}
                  style={{ width: '100%', padding: '0.6rem 0.85rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.35rem' }}>
                  GST / Tax (%)
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="100"
                  value={productToEdit.taxRate ?? '18'}
                  onChange={(e) => setProductToEdit({ ...productToEdit, taxRate: e.target.value })}
                  style={{ width: '100%', padding: '0.6rem 0.85rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.35rem' }}>
                  Stock Qty
                </label>
                <input
                  type="number"
                  min="0"
                  value={productToEdit.stock ?? 0}
                  onChange={(e) => setProductToEdit({ ...productToEdit, stock: e.target.value })}
                  style={{ width: '100%', padding: '0.6rem 0.85rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
              <button
                type="button"
                onClick={() => setProductToEdit(null)}
                style={{ padding: '0.6rem 1.25rem', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#ffffff', color: '#475569', fontWeight: 600, cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isUpdatingProduct}
                style={{ padding: '0.6rem 1.35rem', borderRadius: '6px', border: 'none', background: '#7f22fe', color: '#ffffff', fontWeight: 700, cursor: isUpdatingProduct ? 'not-allowed' : 'pointer' }}
              >
                {isUpdatingProduct ? 'Updating...' : 'Save Changes'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* View Product Details Modal */}
      {productToView && (
        <Modal isOpen={Boolean(productToView)} onClose={() => setProductToView(null)} title={`Product Details — ${productToView.sku}`}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {/* Main Product Image Banner */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: '#f8fafc',
                borderRadius: '10px',
                border: '1px solid #e2e8f0',
                padding: '1rem',
                minHeight: '140px',
                maxHeight: '220px',
                overflow: 'hidden',
              }}
            >
              {productToView.imageUrl ? (
                <img
                  src={getProductImageUrl(productToView.imageUrl, activeCompany?.id, productToView.id)}
                  alt={productToView.name}
                  style={{
                    maxHeight: '200px',
                    maxWidth: '100%',
                    objectFit: 'contain',
                    borderRadius: '6px',
                    cursor: 'pointer',
                  }}
                  onClick={() =>
                    setImageToEnlarge({
                      url: getProductImageUrl(productToView.imageUrl, activeCompany?.id, productToView.id),
                      title: productToView.name,
                      sku: productToView.sku,
                    })
                  }
                  title="Click to view full size"
                />
              ) : (
                <div style={{ textAlign: 'center', color: '#94a3b8' }}>
                  <IconPackage size={40} />
                  <p style={{ margin: '0.35rem 0 0', fontSize: '0.78rem', fontWeight: 600 }}>No image uploaded for this SKU</p>
                </div>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', background: '#f8fafc', padding: '1rem', borderRadius: '8px' }}>
              <div>
                <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>SKU Code</span>
                <p style={{ margin: 0, fontWeight: 800, color: '#7f22fe', fontSize: '1.05rem' }}>{productToView.sku}</p>
              </div>
              <div>
                <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>Status</span>
                <p style={{ margin: 0, fontWeight: 700, color: productToView.status === 'ACTIVE' ? '#047857' : '#64748b' }}>
                  {productToView.status || 'ACTIVE'}
                </p>
              </div>
              <div>
                <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>Product Title</span>
                <p style={{ margin: 0, fontWeight: 700, color: '#0f172a' }}>{productToView.name}</p>
              </div>
              <div>
                <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>Category</span>
                <p style={{ margin: 0, fontWeight: 700, color: '#334155' }}>{productToView.category}</p>
              </div>
            </div>

            {productToView.description && (
              <div>
                <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>Description / Technical Notes</span>
                <p style={{ margin: '0.25rem 0 0', fontSize: '0.85rem', color: '#334155' }}>{productToView.description}</p>
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '1rem', borderTop: '1px solid #e2e8f0', paddingTop: '1rem' }}>
              <div>
                <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>Standard Selling Rate</span>
                <p style={{ margin: 0, fontWeight: 800, color: '#0f172a', fontSize: '1rem' }}>
                  ₹ {Number(productToView.sellingPrice || 0).toFixed(2)}
                </p>
              </div>
              <div>
                <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>Purchase Rate</span>
                <p style={{ margin: 0, fontWeight: 700, color: '#64748b', fontSize: '1rem' }}>
                  ₹ {Number(productToView.purchasePrice || 0).toFixed(2)}
                </p>
              </div>
              <div>
                <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>GST / Tax Rate</span>
                <p style={{ margin: 0, fontWeight: 700, color: '#4338ca', fontSize: '1rem' }}>
                  {Number(productToView.taxRate ?? 18).toFixed(1)}%
                </p>
              </div>
              <div>
                <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>Available Stock</span>
                <p style={{ margin: 0, fontWeight: 800, color: Number(productToView.stock || 0) < 20 ? '#ef4444' : '#10b981', fontSize: '1rem' }}>
                  {productToView.stock ?? 0} {productToView.uom}
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
              <button
                type="button"
                onClick={() => setProductToView(null)}
                style={{ padding: '0.6rem 1.25rem', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#ffffff', color: '#475569', fontWeight: 600, cursor: 'pointer' }}
              >
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal: Fullscreen / Enlarged Image Preview */}
      {imageToEnlarge && (
        <Modal
          isOpen={Boolean(imageToEnlarge)}
          onClose={() => setImageToEnlarge(null)}
          title={`${imageToEnlarge.sku} — ${imageToEnlarge.title}`}
        >
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
            <div
              style={{
                width: '100%',
                maxHeight: '65vh',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: '#0f172a',
                borderRadius: '8px',
                overflow: 'hidden',
                padding: '0.5rem',
              }}
            >
              <img
                src={imageToEnlarge.url}
                alt={imageToEnlarge.title}
                style={{ maxWidth: '100%', maxHeight: '60vh', objectFit: 'contain' }}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', width: '100%' }}>
              <button
                type="button"
                onClick={() => setImageToEnlarge(null)}
                style={{
                  padding: '0.55rem 1.25rem',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  background: '#ffffff',
                  color: '#334155',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Delete Product Dialog */}
      <ConfirmDialog
        isOpen={Boolean(productToDelete)}
        onClose={() => setProductToDelete(null)}
        onConfirm={handleDeleteProduct}
        title="Delete Catalogue SKU?"
        message={`Are you sure you want to remove product "${productToDelete?.name}" (${productToDelete?.sku}) from catalogue?`}
        confirmLabel="Delete SKU"
        isDanger={true}
      />

      {/* =================================================================== */}
      {/* MODALS: CATEGORIES                                                  */}
      {/* =================================================================== */}

      {/* Add Category Modal */}
      <Modal isOpen={showAddCategoryModal} onClose={() => setShowAddCategoryModal(false)} title="Add Product Category">
        <form onSubmit={handleCreateCategory} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.35rem' }}>
              Category Name *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Electrical Components, Raw Material, Packaging"
              value={categoryForm.name}
              onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
              style={{ width: '100%', padding: '0.6rem 0.85rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.35rem' }}>
              Description (Optional)
            </label>
            <textarea
              rows={2}
              placeholder="e.g. Parts, wiring, and circuit components"
              value={categoryForm.description}
              onChange={(e) => setCategoryForm({ ...categoryForm, description: e.target.value })}
              style={{ width: '100%', padding: '0.6rem 0.85rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
            <button
              type="button"
              onClick={() => setShowAddCategoryModal(false)}
              style={{ padding: '0.6rem 1.25rem', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#ffffff', color: '#475569', fontWeight: 600, cursor: 'pointer' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSavingCategory}
              style={{ padding: '0.6rem 1.35rem', borderRadius: '6px', border: 'none', background: '#7f22fe', color: '#ffffff', fontWeight: 700, cursor: isSavingCategory ? 'not-allowed' : 'pointer' }}
            >
              {isSavingCategory ? 'Creating...' : 'Create Category'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Edit Category Modal */}
      {categoryToEdit && (
        <Modal isOpen={Boolean(categoryToEdit)} onClose={() => setCategoryToEdit(null)} title={`Edit Category — ${categoryToEdit.name}`}>
          <form onSubmit={handleUpdateCategory} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.35rem' }}>
                Category Name *
              </label>
              <input
                type="text"
                required
                value={categoryToEdit.name}
                onChange={(e) => setCategoryToEdit({ ...categoryToEdit, name: e.target.value })}
                style={{ width: '100%', padding: '0.6rem 0.85rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.35rem' }}>
                Description
              </label>
              <textarea
                rows={2}
                value={categoryToEdit.description || ''}
                onChange={(e) => setCategoryToEdit({ ...categoryToEdit, description: e.target.value })}
                style={{ width: '100%', padding: '0.6rem 0.85rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
              />
            </div>

            <div style={{ background: '#f8fafc', padding: '0.75rem', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '0.78rem', color: '#64748b' }}>
              ℹ️ <strong>Auto-Propagation:</strong> Renaming this category will automatically update all {categoryToEdit.productCount || 0} currently linked product(s) in your catalogue without duplicating records.
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
              <button
                type="button"
                onClick={() => setCategoryToEdit(null)}
                style={{ padding: '0.6rem 1.25rem', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#ffffff', color: '#475569', fontWeight: 600, cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isUpdatingCategory}
                style={{ padding: '0.6rem 1.35rem', borderRadius: '6px', border: 'none', background: '#7f22fe', color: '#ffffff', fontWeight: 700, cursor: isUpdatingCategory ? 'not-allowed' : 'pointer' }}
              >
                {isUpdatingCategory ? 'Saving...' : 'Update Category'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Delete Blocked Dialog */}
      {categoryDeleteBlocked && (
        <Modal isOpen={Boolean(categoryDeleteBlocked)} onClose={() => setCategoryDeleteBlocked(null)} title="Cannot Delete Category">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: '#b91c1c' }}>
              <IconAlertTriangle size={24} />
              <p style={{ margin: 0, fontWeight: 700, fontSize: '0.92rem' }}>
                Category &quot;{categoryDeleteBlocked.name}&quot; is linked to {categoryDeleteBlocked.productCount} product(s).
              </p>
            </div>
            <p style={{ margin: 0, fontSize: '0.85rem', color: '#475569', lineHeight: 1.5 }}>
              To protect catalogue integrity, categories that have associated products cannot be deleted. Please reassign or update those products to another category before deleting this category.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
              <button
                type="button"
                onClick={() => setCategoryDeleteBlocked(null)}
                style={{ padding: '0.6rem 1.25rem', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#ffffff', color: '#475569', fontWeight: 600, cursor: 'pointer' }}
              >
                Understood
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Delete Category Confirm Dialog */}
      <ConfirmDialog
        isOpen={Boolean(categoryToDelete)}
        onClose={() => setCategoryToDelete(null)}
        onConfirm={handleDeleteCategory}
        title="Delete Product Category?"
        message={`Are you sure you want to remove category "${categoryToDelete?.name}"?`}
        confirmLabel="Delete Category"
        isDanger={true}
      />

      {/* =================================================================== */}
      {/* MODALS: PRICING & PLANS                                             */}
      {/* =================================================================== */}

      {/* Add Pricing Modal */}
      <Modal isOpen={showAddPricingModal} onClose={() => setShowAddPricingModal(false)} title="Configure Product Price Plan">
        <form onSubmit={handleCreatePricing} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.35rem' }}>
              Target Catalogue Product *
            </label>
            <select
              required
              value={pricingForm.productId}
              onChange={(e) => setPricingForm({ ...pricingForm, productId: e.target.value })}
              style={{ width: '100%', padding: '0.6rem 0.85rem', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#ffffff' }}
            >
              <option value="">Select a product from catalogue...</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.sku} — {p.name} ({p.category})
                </option>
              ))}
            </select>
            <span style={{ fontSize: '0.74rem', color: '#64748b', display: 'block', marginTop: '0.25rem' }}>
              Configuring pricing connects to the existing product and will not create a duplicate SKU.
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.35rem' }}>
                Plan / Tier Name *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Wholesale Tier, Retail Rate, Project Tier"
                value={pricingForm.planName}
                onChange={(e) => setPricingForm({ ...pricingForm, planName: e.target.value })}
                style={{ width: '100%', padding: '0.6rem 0.85rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.35rem' }}>
                Status
              </label>
              <select
                value={pricingForm.status}
                onChange={(e) => setPricingForm({ ...pricingForm, status: e.target.value })}
                style={{ width: '100%', padding: '0.6rem 0.85rem', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#ffffff' }}
              >
                <option value="ACTIVE">ACTIVE</option>
                <option value="INACTIVE">INACTIVE</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.35rem' }}>
                Selling Rate (₹) *
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                required
                placeholder="0.00"
                value={pricingForm.sellingPrice}
                onChange={(e) => setPricingForm({ ...pricingForm, sellingPrice: e.target.value })}
                style={{ width: '100%', padding: '0.6rem 0.85rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.35rem' }}>
                Purchase Rate (₹)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={pricingForm.purchasePrice}
                onChange={(e) => setPricingForm({ ...pricingForm, purchasePrice: e.target.value })}
                style={{ width: '100%', padding: '0.6rem 0.85rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.35rem' }}>
                Applicable Tax / GST (%)
              </label>
              <input
                type="number"
                step="0.1"
                min="0"
                max="100"
                placeholder="18.0"
                value={pricingForm.taxRate}
                onChange={(e) => setPricingForm({ ...pricingForm, taxRate: e.target.value })}
                style={{ width: '100%', padding: '0.6rem 0.85rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.35rem' }}>
                Special Discount (%)
              </label>
              <input
                type="number"
                step="0.1"
                min="0"
                max="100"
                placeholder="0.0"
                value={pricingForm.discountRate}
                onChange={(e) => setPricingForm({ ...pricingForm, discountRate: e.target.value })}
                style={{ width: '100%', padding: '0.6rem 0.85rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
              />
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: '#f8fafc', padding: '0.75rem', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
            <input
              type="checkbox"
              id="isDefaultPricing"
              checked={pricingForm.isDefault}
              onChange={(e) => setPricingForm({ ...pricingForm, isDefault: e.target.checked })}
              style={{ width: '16px', height: '16px' }}
            />
            <label htmlFor="isDefaultPricing" style={{ fontSize: '0.82rem', fontWeight: 600, color: '#334155', cursor: 'pointer' }}>
              Set as primary standard default rate for this product
            </label>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
            <button
              type="button"
              onClick={() => setShowAddPricingModal(false)}
              style={{ padding: '0.6rem 1.25rem', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#ffffff', color: '#475569', fontWeight: 600, cursor: 'pointer' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSavingPricing}
              style={{ padding: '0.6rem 1.35rem', borderRadius: '6px', border: 'none', background: '#7f22fe', color: '#ffffff', fontWeight: 700, cursor: isSavingPricing ? 'not-allowed' : 'pointer' }}
            >
              {isSavingPricing ? 'Configuring...' : 'Save Price Plan'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Edit Pricing Modal */}
      {pricingToEdit && (
        <Modal isOpen={Boolean(pricingToEdit)} onClose={() => setPricingToEdit(null)} title={`Edit Price Plan — ${pricingToEdit.planName}`}>
          <form onSubmit={handleUpdatePricing} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>Linked Product</span>
              <p style={{ margin: '0.2rem 0 0', fontWeight: 700, color: '#0f172a' }}>
                {pricingToEdit.product?.sku} — {pricingToEdit.product?.name}
              </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.35rem' }}>
                  Plan Name *
                </label>
                <input
                  type="text"
                  required
                  value={pricingToEdit.planName}
                  onChange={(e) => setPricingToEdit({ ...pricingToEdit, planName: e.target.value })}
                  style={{ width: '100%', padding: '0.6rem 0.85rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.35rem' }}>
                  Status
                </label>
                <select
                  value={pricingToEdit.status || 'ACTIVE'}
                  onChange={(e) => setPricingToEdit({ ...pricingToEdit, status: e.target.value })}
                  style={{ width: '100%', padding: '0.6rem 0.85rem', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#ffffff' }}
                >
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="INACTIVE">INACTIVE</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.35rem' }}>
                  Selling Rate (₹) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  value={pricingToEdit.sellingPrice}
                  onChange={(e) => setPricingToEdit({ ...pricingToEdit, sellingPrice: e.target.value })}
                  style={{ width: '100%', padding: '0.6rem 0.85rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.35rem' }}>
                  Purchase Rate (₹)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={pricingToEdit.purchasePrice}
                  onChange={(e) => setPricingToEdit({ ...pricingToEdit, purchasePrice: e.target.value })}
                  style={{ width: '100%', padding: '0.6rem 0.85rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.35rem' }}>
                  Applicable Tax (%)
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="100"
                  value={pricingToEdit.taxRate}
                  onChange={(e) => setPricingToEdit({ ...pricingToEdit, taxRate: e.target.value })}
                  style={{ width: '100%', padding: '0.6rem 0.85rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.35rem' }}>
                  Discount (%)
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="100"
                  value={pricingToEdit.discountRate}
                  onChange={(e) => setPricingToEdit({ ...pricingToEdit, discountRate: e.target.value })}
                  style={{ width: '100%', padding: '0.6rem 0.85rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: '#f8fafc', padding: '0.75rem', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
              <input
                type="checkbox"
                id="editIsDefaultPricing"
                checked={pricingToEdit.isDefault}
                onChange={(e) => setPricingToEdit({ ...pricingToEdit, isDefault: e.target.checked })}
                style={{ width: '16px', height: '16px' }}
              />
              <label htmlFor="editIsDefaultPricing" style={{ fontSize: '0.82rem', fontWeight: 600, color: '#334155', cursor: 'pointer' }}>
                Set as primary standard default rate for this product
              </label>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
              <button
                type="button"
                onClick={() => setPricingToEdit(null)}
                style={{ padding: '0.6rem 1.25rem', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#ffffff', color: '#475569', fontWeight: 600, cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isUpdatingPricing}
                style={{ padding: '0.6rem 1.35rem', borderRadius: '6px', border: 'none', background: '#7f22fe', color: '#ffffff', fontWeight: 700, cursor: isUpdatingPricing ? 'not-allowed' : 'pointer' }}
              >
                {isUpdatingPricing ? 'Updating...' : 'Save Plan Changes'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Delete Pricing Confirm Dialog */}
      <ConfirmDialog
        isOpen={Boolean(pricingToDelete)}
        onClose={() => setPricingToDelete(null)}
        onConfirm={handleDeletePricing}
        title="Delete Price Plan?"
        message={`Are you sure you want to delete plan "${pricingToDelete?.planName}" for product "${pricingToDelete?.product?.sku}"? The product itself will remain in catalogue.`}
        confirmLabel="Delete Price Plan"
        isDanger={true}
      />
    </div>
  );
}
