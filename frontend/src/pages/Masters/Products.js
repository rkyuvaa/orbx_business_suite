import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { Button, Box, Alert, Typography, Tabs, Tab, Paper } from '@mui/material';
import { Add as AddIcon } from '@mui/icons-material';

import apiClient from '../../api/client';
import PageHeader from '../../components/PageHeader';
import CommonTable from '../../components/CommonTable';
import CommonModal from '../../components/CommonModal';
import FormInput from '../../components/FormInput';

const productSchema = yup.object().shape({
  name: yup.string().required('Product name is required'),
  sku: yup.string().required('SKU code is required'),
  category_id: yup.string().required('Category is required'),
  uom: yup.string().default('PCS'),
  hsn_code: yup.string().nullable(),
  tax_rate: yup.number().typeError('Must be a number').default(18.0),
  purchase_price: yup.number().typeError('Must be a number').default(0.0),
  selling_price: yup.number().typeError('Must be a number').default(0.0),
  min_stock_level: yup.number().typeError('Must be a number').default(0.0),
});

const categorySchema = yup.object().shape({
  name: yup.string().required('Category name is required'),
  description: yup.string().nullable(),
});

const Products = () => {
  const [tabIndex, setTabIndex] = useState(0);
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [openProductModal, setOpenProductModal] = useState(false);
  const [openCategoryModal, setOpenCategoryModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [error, setError] = useState(null);

  const { control: pControl, handleSubmit: pSubmit, reset: pReset } = useForm({
    resolver: yupResolver(productSchema),
  });

  const { control: cControl, handleSubmit: cSubmit, reset: cReset } = useForm({
    resolver: yupResolver(categorySchema),
  });

  const loadData = async () => {
    try {
      const pRes = await apiClient.get('/products/');
      const cRes = await apiClient.get('/products/categories');
      setProducts(pRes.data);
      setCategories(cRes.data);
    } catch (err) {
      setError('Failed to load product/category information.');
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleTabChange = (event, newIndex) => {
    setTabIndex(newIndex);
  };

  // ==========================================
  // PRODUCT HANDLERS
  // ==========================================
  const handleOpenAddProduct = () => {
    setSelectedProduct(null);
    pReset({
      name: '',
      sku: '',
      category_id: categories.length > 0 ? categories[0].id : '',
      uom: 'PCS',
      hsn_code: '',
      tax_rate: 18,
      purchase_price: 0,
      selling_price: 0,
      min_stock_level: 0,
    });
    setOpenProductModal(true);
  };

  const handleOpenEditProduct = (product) => {
    setSelectedProduct(product);
    pReset(product);
    setOpenProductModal(true);
  };

  const handleDeactivateProduct = async (product) => {
    if (window.confirm(`Are you sure you want to deactivate product '${product.name}'?`)) {
      try {
        await apiClient.put(`/products/${product.id}`, { is_active: false });
        loadData();
      } catch (err) {
        setError('Failed to deactivate product.');
      }
    }
  };

  const handleActivateProduct = async (product) => {
    try {
      await apiClient.put(`/products/${product.id}`, { is_active: true });
      loadData();
    } catch (err) {
      setError('Failed to activate product.');
    }
  };

  const onProductSubmit = async (data) => {
    try {
      if (selectedProduct) {
        await apiClient.put(`/products/${selectedProduct.id}`, data);
      } else {
        await apiClient.post('/products/', data);
      }
      setOpenProductModal(false);
      loadData();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to save product catalog details.');
    }
  };

  // ==========================================
  // CATEGORY HANDLERS
  // ==========================================
  const handleOpenAddCategory = () => {
    setSelectedCategory(null);
    cReset({ name: '', description: '' });
    setOpenCategoryModal(true);
  };

  const handleOpenEditCategory = (category) => {
    setSelectedCategory(category);
    cReset(category);
    setOpenCategoryModal(true);
  };

  const onCategorySubmit = async (data) => {
    try {
      if (selectedCategory) {
        await apiClient.put(`/products/categories/${selectedCategory.id}`, data);
      } else {
        await apiClient.post('/products/categories', data);
      }
      setOpenCategoryModal(false);
      loadData();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to save category.');
    }
  };

  const productColumns = [
    { id: 'sku', label: 'SKU Code' },
    { id: 'name', label: 'Product Name' },
    {
      id: 'category_id',
      label: 'Category',
      render: (row) => {
        const cat = categories.find((c) => c.id === row.category_id);
        return cat ? cat.name : 'Unknown';
      },
    },
    { id: 'uom', label: 'UOM' },
    {
      id: 'purchase_price',
      label: 'Purchase Price',
      render: (row) => `$${row.purchase_price.toFixed(2)}`,
    },
    {
      id: 'selling_price',
      label: 'Selling Price',
      render: (row) => `$${row.selling_price.toFixed(2)}`,
    },
    {
      id: 'is_active',
      label: 'Status',
      render: (row) => (
        <Typography
          variant="caption"
          sx={{
            px: 1,
            py: 0.5,
            borderRadius: '4px',
            fontWeight: 600,
            backgroundColor: row.is_active ? 'rgba(45, 106, 79, 0.1)' : 'rgba(217, 4, 41, 0.1)',
            color: row.is_active ? '#2d6a4f' : '#d90429',
          }}
        >
          {row.is_active ? 'Active' : 'Inactive'}
        </Typography>
      ),
    },
  ];

  const productActions = [
    { type: 'edit', label: 'Edit Product', onClick: handleOpenEditProduct },
    {
      type: 'deactivate',
      label: 'Deactivate',
      condition: (row) => row.is_active,
      onClick: handleDeactivateProduct,
      color: 'error',
    },
    {
      type: 'activate',
      label: 'Activate',
      condition: (row) => !row.is_active,
      onClick: handleActivateProduct,
      color: 'success',
    },
  ];

  const categoryColumns = [
    { id: 'name', label: 'Category Name' },
    { id: 'description', label: 'Description' },
    {
      id: 'is_active',
      label: 'Status',
      render: (row) => (
        <Typography
          variant="caption"
          sx={{
            px: 1,
            py: 0.5,
            borderRadius: '4px',
            fontWeight: 600,
            backgroundColor: row.is_active ? 'rgba(45, 106, 79, 0.1)' : 'rgba(217, 4, 41, 0.1)',
            color: row.is_active ? '#2d6a4f' : '#d90429',
          }}
        >
          {row.is_active ? 'Active' : 'Inactive'}
        </Typography>
      ),
    },
  ];

  const categoryActions = [
    { type: 'edit', label: 'Edit Category', onClick: handleOpenEditCategory },
  ];

  const uomOptions = [
    { value: 'PCS', label: 'Pieces (PCS)' },
    { value: 'KG', label: 'Kilograms (KG)' },
    { value: 'LTR', label: 'Liters (LTR)' },
    { value: 'BOX', label: 'Boxes (BOX)' },
  ];

  const categoryOptions = categories.map((c) => ({
    value: c.id,
    label: c.name,
  }));

  return (
    <Box>
      {error && (
        <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      <Paper sx={{ mb: 3, borderRadius: '8px' }}>
        <Tabs value={tabIndex} onChange={handleTabChange} sx={{ px: 2, borderBottom: '1px solid #e2e8f0' }}>
          <Tab label="Products Catalog" sx={{ fontWeight: 600 }} />
          <Tab label="Product Categories" sx={{ fontWeight: 600 }} />
        </Tabs>
      </Paper>

      {tabIndex === 0 ? (
        <CommonTable
          columns={productColumns}
          rows={products}
          actions={productActions}
          searchKey="name"
          tableActions={
            <Button variant="contained" startIcon={<AddIcon />} onClick={handleOpenAddProduct}>
              Add Product
            </Button>
          }
        />
      ) : (
        <CommonTable
          columns={categoryColumns}
          rows={categories}
          actions={categoryActions}
          searchKey="name"
          tableActions={
            <Button variant="contained" startIcon={<AddIcon />} onClick={handleOpenAddCategory}>
              Add Category
            </Button>
          }
        />
      )}

      {/* Product Modal */}
      <CommonModal
        open={openProductModal}
        onClose={() => setOpenProductModal(false)}
        title={selectedProduct ? 'Edit Product SKU details' : 'Add New Product'}
      >
        <form onSubmit={pSubmit(onProductSubmit)}>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
            <FormInput name="name" control={pControl} label="Product Name" />
            <FormInput name="sku" control={pControl} label="SKU Code" disabled={!!selectedProduct} />
            
            <FormInput
              name="category_id"
              control={pControl}
              label="Category"
              type="select"
              options={categoryOptions}
            />
            
            <FormInput
              name="uom"
              control={pControl}
              label="Unit of Measure"
              type="select"
              options={uomOptions}
            />

            <FormInput name="hsn_code" control={pControl} label="HSN Code" />
            <FormInput name="tax_rate" control={pControl} label="Tax Rate (%)" type="number" />
            <FormInput name="purchase_price" control={pControl} label="Purchase Rate ($)" type="number" />
            <FormInput name="selling_price" control={pControl} label="Selling Rate ($)" type="number" />
            
            <Box sx={{ gridColumn: 'span 2' }}>
              <FormInput name="min_stock_level" control={pControl} label="Minimum stock level alert threshold" type="number" />
            </Box>
          </Box>
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, mt: 3 }}>
            <Button onClick={() => setOpenProductModal(false)} variant="outlined">
              Cancel
            </Button>
            <Button type="submit" variant="contained">
              Save
            </Button>
          </Box>
        </form>
      </CommonModal>

      {/* Category Modal */}
      <CommonModal
        open={openCategoryModal}
        onClose={() => setOpenCategoryModal(false)}
        title={selectedCategory ? 'Edit Category' : 'Add New Category'}
      >
        <form onSubmit={cSubmit(onCategorySubmit)}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <FormInput name="name" control={cControl} label="Category Name" />
            <FormInput name="description" control={cControl} label="Description" type="textarea" rows={3} />
          </Box>
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, mt: 3 }}>
            <Button onClick={() => setOpenCategoryModal(false)} variant="outlined">
              Cancel
            </Button>
            <Button type="submit" variant="contained">
              Save
            </Button>
          </Box>
        </form>
      </CommonModal>
    </Box>
  );
};

export default Products;
