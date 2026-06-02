import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { Button, Box, Alert, Typography } from '@mui/material';
import { Add as AddIcon } from '@mui/icons-material';

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
  billing_address: yup.string().nullable(),
  shipping_address: yup.string().nullable(),
  credit_limit: yup.number().typeError('Must be a number').default(0.0),
  payment_terms: yup.string().nullable(),
});

const Customers = () => {
  const [customers, setCustomers] = useState([]);
  const [openModal, setOpenModal] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [error, setError] = useState(null);

  const { control, handleSubmit, reset } = useForm({
    resolver: yupResolver(schema),
  });

  const loadCustomers = async () => {
    try {
      const res = await apiClient.get('/customers/');
      setCustomers(res.data);
    } catch (err) {
      setError('Failed to load customer list.');
    }
  };

  useEffect(() => {
    loadCustomers();
  }, []);

  const handleOpenAdd = () => {
    setSelectedCustomer(null);
    reset({
      name: '',
      code: '',
      gstin: '',
      phone: '',
      alternative_phone: '',
      email: '',
      billing_address: '',
      shipping_address: '',
      credit_limit: 0,
      payment_terms: '',
    });
    setOpenModal(true);
  };

  const handleOpenEdit = (customer) => {
    setSelectedCustomer(customer);
    reset(customer);
    setOpenModal(true);
  };

  const handleDeactivate = async (customer) => {
    if (window.confirm(`Are you sure you want to deactivate customer '${customer.name}'?`)) {
      try {
        await apiClient.put(`/customers/${customer.id}`, { is_active: false });
        loadCustomers();
      } catch (err) {
        setError('Failed to deactivate customer.');
      }
    }
  };

  const handleActivate = async (customer) => {
    try {
      await apiClient.put(`/customers/${customer.id}`, { is_active: true });
      loadCustomers();
    } catch (err) {
      setError('Failed to activate customer.');
    }
  };

  const onSubmit = async (data) => {
    try {
      if (selectedCustomer) {
        await apiClient.put(`/customers/${selectedCustomer.id}`, data);
      } else {
        await apiClient.post('/customers/', data);
      }
      setOpenModal(false);
      loadCustomers();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to save customer details.');
    }
  };

  const columns = [
    { id: 'code', label: 'Code' },
    { id: 'name', label: 'Customer Name' },
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
    { type: 'edit', label: 'Edit Customer', onClick: handleOpenEdit },
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
      {error && (
        <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      <CommonTable
        columns={columns}
        rows={customers}
        actions={actions}
        searchKey="name"
        tableActions={
          <Button variant="contained" startIcon={<AddIcon />} onClick={handleOpenAdd}>
            Add Customer
          </Button>
        }
      />

      <CommonModal
        open={openModal}
        onClose={() => setOpenModal(false)}
        title={selectedCustomer ? 'Edit Customer Details' : 'Add New Customer'}
      >
        <form onSubmit={handleSubmit(onSubmit)}>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
            <FormInput name="name" control={control} label="Customer Name" />
            <FormInput name="code" control={control} label="Customer Code (Auto-generated if blank)" disabled={!!selectedCustomer} />
            <FormInput name="gstin" control={control} label="GSTIN" />
            <FormInput name="phone" control={control} label="Phone Number" />
            <FormInput name="alternative_phone" control={control} label="Alternative Phone" />
            <FormInput name="email" control={control} label="Email Address" type="email" />
            <FormInput name="payment_terms" control={control} label="Payment Terms" />
            <FormInput name="credit_limit" control={control} label="Credit Limit" type="number" />
            <Box sx={{ gridColumn: 'span 2' }}>
              <FormInput name="billing_address" control={control} label="Billing Address" type="textarea" rows={2} />
              <FormInput name="shipping_address" control={control} label="Shipping Address" type="textarea" rows={2} />
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

export default Customers;
