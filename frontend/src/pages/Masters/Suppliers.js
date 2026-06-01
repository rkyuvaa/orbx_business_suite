import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { Button, Box, Alert, Typography, Divider } from '@mui/material';
import { Add as AddIcon } from '@mui/icons-material';

import apiClient from '../../api/client';
import PageHeader from '../../components/PageHeader';
import CommonTable from '../../components/CommonTable';
import CommonModal from '../../components/CommonModal';
import FormInput from '../../components/FormInput';

const schema = yup.object().shape({
  name: yup.string().required('Name is required'),
  code: yup.string().required('Supplier code is required'),
  gstin: yup.string().nullable().max(15, 'GSTIN cannot exceed 15 chars'),
  phone: yup.string().nullable(),
  email: yup.string().email('Please enter a valid email').nullable(),
  address: yup.string().nullable(),
  payment_terms: yup.string().nullable(),
  bank_name: yup.string().nullable(),
  bank_account_no: yup.string().nullable(),
  bank_ifsc: yup.string().nullable(),
});

const Suppliers = () => {
  const [suppliers, setSuppliers] = useState([]);
  const [openModal, setOpenModal] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState(null);
  const [error, setError] = useState(null);

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
      email: '',
      address: '',
      payment_terms: '',
      bank_name: '',
      bank_account_no: '',
      bank_ifsc: '',
    });
    setOpenModal(true);
  };

  const handleOpenEdit = (supplier) => {
    setSelectedSupplier(supplier);
    // Unpack bank details for form prefilling
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

  const onSubmit = async (data) => {
    try {
      // Repack bank details
      const payload = {
        name: data.name,
        code: data.code,
        gstin: data.gstin,
        phone: data.phone,
        email: data.email,
        address: data.address,
        payment_terms: data.payment_terms,
        bank_details: {
          bank_name: data.bank_name,
          bank_account_no: data.bank_account_no,
          bank_ifsc: data.bank_ifsc,
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
      setError(err.response?.data?.detail || 'Failed to save supplier details.');
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
  ];

  return (
    <Box>
      <PageHeader
        title="Supplier Master"
        breadcrumbs={[
          { label: 'Dashboard', to: '/' },
          { label: 'Supplier Master' },
        ]}
        actions={
          <Button variant="contained" startIcon={<AddIcon />} onClick={handleOpenAdd}>
            Add Supplier
          </Button>
        }
      />

      {error && (
        <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      <CommonTable columns={columns} rows={suppliers} actions={actions} searchKey="name" />

      <CommonModal
        open={openModal}
        onClose={() => setOpenModal(false)}
        title={selectedSupplier ? 'Edit Supplier Details' : 'Add New Supplier'}
      >
        <form onSubmit={handleSubmit(onSubmit)}>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
            <FormInput name="name" control={control} label="Supplier Name" />
            <FormInput name="code" control={control} label="Supplier Code" disabled={!!selectedSupplier} />
            <FormInput name="gstin" control={control} label="GSTIN" />
            <FormInput name="phone" control={control} label="Phone Number" />
            <FormInput name="email" control={control} label="Email Address" type="email" />
            <FormInput name="payment_terms" control={control} label="Payment Terms" />
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
