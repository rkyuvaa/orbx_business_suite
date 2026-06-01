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
  branch_name: yup.string().required('Branch name is required'),
  code: yup.string().required('Branch code is required'),
  address: yup.string().required('Branch address is required'),
  invoice_prefix: yup.string().required('Invoice prefix is required'),
  invoice_next_number: yup.number().typeError('Must be a number').required('Sequence is required'),
  invoice_terms: yup.string().nullable(),
  invoice_footer: yup.string().nullable(),
});

const Branches = () => {
  const [branches, setBranches] = useState([]);
  const [openModal, setOpenModal] = useState(false);
  const [selectedBranch, setSelectedBranch] = useState(null);
  const [error, setError] = useState(null);

  const { control, handleSubmit, reset } = useForm({
    resolver: yupResolver(schema),
  });

  const loadBranches = async () => {
    try {
      const res = await apiClient.get('/admin/branches');
      setBranches(res.data);
    } catch (err) {
      setError('Failed to load branches.');
    }
  };

  useEffect(() => {
    loadBranches();
  }, []);

  const handleOpenAdd = () => {
    setSelectedBranch(null);
    reset({
      branch_name: '',
      code: '',
      address: '',
      invoice_prefix: 'INV-',
      invoice_next_number: 1,
      invoice_terms: '',
      invoice_footer: '',
    });
    setOpenModal(true);
  };

  const handleOpenEdit = (branch) => {
    setSelectedBranch(branch);
    reset(branch);
    setOpenModal(true);
  };

  const onSubmit = async (data) => {
    try {
      if (selectedBranch) {
        await apiClient.put(`/admin/branches/${selectedBranch.id}`, data);
      } else {
        await apiClient.post('/admin/branches', data);
      }
      setOpenModal(false);
      loadBranches();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to save branch.');
    }
  };

  const columns = [
    { id: 'code', label: 'Code' },
    { id: 'branch_name', label: 'Branch Name' },
    { id: 'invoice_prefix', label: 'Invoice Prefix' },
    { id: 'invoice_next_number', label: 'Next Sequence No.' },
    { id: 'address', label: 'Address' },
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
    { type: 'edit', label: 'Edit Branch Config', onClick: handleOpenEdit },
  ];

  return (
    <Box>
      <PageHeader
        title="Branches"
        breadcrumbs={[
          { label: 'Dashboard', to: '/' },
          { label: 'Branches' },
        ]}
        actions={
          <Button variant="contained" startIcon={<AddIcon />} onClick={handleOpenAdd}>
            Add Branch
          </Button>
        }
      />

      {error && (
        <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      <CommonTable columns={columns} rows={branches} actions={actions} searchKey="branch_name" />

      <CommonModal
        open={openModal}
        onClose={() => setOpenModal(false)}
        title={selectedBranch ? 'Edit Branch Configuration' : 'Add New Branch'}
      >
        <form onSubmit={handleSubmit(onSubmit)}>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
            <FormInput name="branch_name" control={control} label="Branch Office Name" />
            <FormInput name="code" control={control} label="Branch Code" disabled={!!selectedBranch} />
            <Box sx={{ gridColumn: 'span 2' }}>
              <FormInput name="address" control={control} label="Physical Office Address" type="textarea" rows={2} />
            </Box>

            <Box sx={{ gridColumn: 'span 2', mt: 1 }}>
              <Typography variant="subtitle2" color="primary.main" sx={{ fontWeight: 600, mb: 1 }}>
                Invoice Sequence Configuration
              </Typography>
              <Divider sx={{ mb: 2 }} />
            </Box>

            <FormInput name="invoice_prefix" control={control} label="Invoice Prefix (e.g. INV-)" />
            <FormInput name="invoice_next_number" control={control} label="Next Sequence Number" type="number" />
            <Box sx={{ gridColumn: 'span 2' }}>
              <FormInput name="invoice_terms" control={control} label="Default Invoice Terms & Conditions" type="textarea" rows={2} />
              <FormInput name="invoice_footer" control={control} label="Default Invoice Footer Note" />
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

export default Branches;
