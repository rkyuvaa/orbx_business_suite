import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { Button, Box, Alert, Typography, Divider } from '@mui/material';
import { Add as AddIcon, Delete as DeleteIcon } from '@mui/icons-material';
import { useSelector } from 'react-redux';

import apiClient from '../../api/client';
import PageHeader from '../../components/PageHeader';
import CommonTable from '../../components/CommonTable';
import CommonModal from '../../components/CommonModal';
import FormInput from '../../components/FormInput';

const schema = yup.object().shape({
  name: yup.string().required('Name is required'),
  code: yup.string().nullable(),
  gstin: yup.string().nullable().max(15, 'GSTIN cannot exceed 15 chars'),
  phone: yup.string().nullable(),
  alternative_phone: yup.string().nullable(),
  email: yup.string().email('Please enter a valid email').nullable(),
  address: yup.string().nullable(),
  payment_terms: yup.string().nullable(),
  bank_name: yup.string().nullable(),
  bank_account_no: yup.string().nullable(),
  bank_ifsc: yup.string().nullable(),
  opening_bal: yup.number().typeError('Must be a number').default(0.0),
  opening_bal_type: yup.string().default('Cr'),
});

const Suppliers = () => {
  const [suppliers, setSuppliers] = useState([]);
  const [openModal, setOpenModal] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState(null);
  const [error, setError] = useState(null);

  const { user } = useSelector((state) => state.auth);
  const isSuperAdmin = user?.role_name === 'Super Admin';

  const { control, handleSubmit, reset } = useForm({
    resolver: yupResolver(schema),
  });

  const loadSuppliers = async () => {
    try {
      const res = await apiClient.get('/suppliers/');
      setSuppliers(res.data);
    } catch (err) {
      setError('Failed to load supplier list.');
    }
  };

  useEffect(() => {
    loadSuppliers();
  }, []);

  const handleOpenAdd = () => {
    setSelectedSupplier(null);
    reset({
      name: '',
      code: '',
      gstin: '',
      phone: '',
      alternative_phone: '',
      email: '',
      address: '',
      payment_terms: '',
      bank_name: '',
      bank_account_no: '',
      bank_ifsc: '',
      opening_bal: 0,
      opening_bal_type: 'Cr',
    });
    setOpenModal(true);
  };

  const handleOpenEdit = (supplier) => {
    setSelectedSupplier(supplier);
    const bank = supplier.bank_details || {};
    reset({
      ...supplier,
      bank_name: bank.bank_name || '',
      bank_account_no: bank.bank_account_no || '',
      bank_ifsc: bank.bank_ifsc || '',
    });
    setOpenModal(true);
  };

  const handleDeactivate = async (supplier) => {
    if (window.confirm(`Are you sure you want to deactivate supplier '${supplier.name}'?`)) {
      try {
        await apiClient.put(`/suppliers/${supplier.id}`, { is_active: false });
        loadSuppliers();
      } catch (err) {
        setError('Failed to deactivate supplier.');
      }
    }
  };

  const handleActivate = async (supplier) => {
    try {
      await apiClient.put(`/suppliers/${supplier.id}`, { is_active: true });
      loadSuppliers();
    } catch (err) {
      setError('Failed to activate supplier.');
    }
  };

  const handleDeleteSupplier = async (supplier) => {
    if (window.confirm(`WARNING: Are you sure you want to PERMANENTLY delete supplier '${supplier.name}'? This action cannot be undone.`)) {
      try {
        await apiClient.delete(`/suppliers/${supplier.id}`);
        loadSuppliers();
      } catch (err) {
        setError(err.response?.data?.detail || 'Failed to delete supplier.');
      }
    }
  };

  const onSubmit = async (data) => {
    try {
      const payload = {
        code: data.code || null,
        name: data.name,
        gstin: data.gstin || null,
        phone: data.phone || null,
        alternative_phone: data.alternative_phone || null,
        email: data.email || null,
        address: data.address || null,
        payment_terms: data.payment_terms || null,
        opening_bal: data.opening_bal || 0.0,
        opening_bal_type: data.opening_bal_type || 'Cr',
        bank_details: {
          bank_name: data.bank_name || null,
          bank_account_no: data.bank_account_no || null,
          bank_ifsc: data.bank_ifsc || null,
        },
      };

      if (selectedSupplier) {
        await apiClient.put(`/suppliers/${selectedSupplier.id}`, payload);
      } else {
        await apiClient.post('/suppliers/', payload);
      }
      setOpenModal(false);
      loadSuppliers();
    } catch (err) {
      const detail = err.response?.data?.detail;
      let errorMsg = 'Failed to save supplier details.';
      if (typeof detail === 'string') {
        errorMsg = detail;
      } else if (Array.isArray(detail)) {
        errorMsg = detail.map((d) => `${d.loc?.join('.') || 'Field'}: ${d.msg}`).join(', ');
      }
      setError(errorMsg);
    }
  };

  const columns = [
    { id: 'code', label: 'Code' },
    { id: 'name', label: 'Supplier Name' },
    { id: 'gstin', label: 'GSTIN' },
    { id: 'email', label: 'Email' },
    { id: 'phone', label: 'Phone' },
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

  const actions = [
    { type: 'edit', label: 'Edit Supplier', onClick: handleOpenEdit },
    {
      type: 'deactivate',
      label: 'Deactivate',
      condition: (row) => row.is_active,
      onClick: handleDeactivate,
      color: 'error',
    },
    {
      type: 'activate',
      label: 'Activate',
      condition: (row) => !row.is_active,
      onClick: handleActivate,
      color: 'success',
    },
    ...(isSuperAdmin ? [{
      type: 'delete',
      label: 'Delete Supplier',
      icon: <DeleteIcon />,
      onClick: handleDeleteSupplier,
      color: 'error',
    }] : [])
  ];

  return (
    <Box>
      {error && (
        <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      <CommonTable
        columns={columns}
        rows={suppliers}
        actions={actions}
        searchKey="name"
        tableActions={
          <Button variant="contained" startIcon={<AddIcon />} onClick={handleOpenAdd}>
            Add Supplier
          </Button>
        }
      />

      <CommonModal
        open={openModal}
        onClose={() => setOpenModal(false)}
        title={selectedSupplier ? 'Edit Supplier Details' : 'Add New Supplier'}
      >
        <form onSubmit={handleSubmit(onSubmit)}>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
            <FormInput name="name" control={control} label="Supplier Name" />
            <FormInput name="code" control={control} label="Supplier Code (Auto-generated if blank)" disabled={!!selectedSupplier} />
            <FormInput name="gstin" control={control} label="GSTIN" />
            <FormInput name="phone" control={control} label="Phone Number" />
            <FormInput name="alternative_phone" control={control} label="Alternative Phone" />
            <FormInput name="email" control={control} label="Email Address" type="email" />
            <FormInput name="payment_terms" control={control} label="Payment Terms" />
            <FormInput name="opening_bal" control={control} label="Opening Balance (₹)" type="number" />
            <FormInput
              name="opening_bal_type"
              control={control}
              label="Opening Balance Type"
              type="select"
              options={[
                { value: 'Dr', label: 'Debit (Dr) - Receivable' },
                { value: 'Cr', label: 'Credit (Cr) - Payable' }
              ]}
            />
            <Box sx={{ gridColumn: 'span 2' }}>
              <FormInput name="address" control={control} label="Office Address" type="textarea" rows={2} />
            </Box>

            <Box sx={{ gridColumn: 'span 2', mt: 1 }}>
              <Typography variant="subtitle2" color="primary.main" sx={{ fontWeight: 600, mb: 2 }}>
                Bank Account Remittance Details
              </Typography>
              <Divider sx={{ mb: 2 }} />
            </Box>

            <FormInput name="bank_name" control={control} label="Bank Name" />
            <FormInput name="bank_account_no" control={control} label="Account Number" />
            <Box sx={{ gridColumn: 'span 2' }}>
              <FormInput name="bank_ifsc" control={control} label="IFSC / SWIFT Code" />
            </Box>
          </Box>
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, mt: 3 }}>
            <Button onClick={() => setOpenModal(false)} variant="outlined">
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

export default Suppliers;
