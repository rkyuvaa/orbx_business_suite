import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import {
  Box, Button, Typography, Alert, Paper, Chip, Tooltip, IconButton
} from '@mui/material';
import {
  Add as AddIcon,
  ReceiptLong as VoucherIcon
} from '@mui/icons-material';

import apiClient from '../../api/client';
import CommonTable from '../../components/CommonTable';
import CommonModal from '../../components/CommonModal';
import FormInput from '../../components/FormInput';

const schema = yup.object().shape({
  name: yup.string().required('Name is required').max(50, 'Max 50 characters'),
  prefix: yup.string().required('Prefix is required').max(20, 'Max 20 characters'),
  numbering_method: yup.string().required('Numbering method is required')
});

const VoucherTypes = () => {
  const [voucherTypes, setVoucherTypes] = useState([]);
  const [openModal, setOpenModal] = useState(false);
  const [selectedVoucherType, setSelectedVoucherType] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const { control, handleSubmit, reset } = useForm({
    resolver: yupResolver(schema),
    defaultValues: { name: '', prefix: '', numbering_method: 'Automatic' }
  });

  const loadVoucherTypes = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get('/accounts/vouchers/types');
      setVoucherTypes(res.data);
      setError(null);
    } catch (err) {
      setError('Failed to load voucher types.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadVoucherTypes();
  }, []);

  const handleOpenAdd = () => {
    setSelectedVoucherType(null);
    reset({
      name: '',
      prefix: '',
      numbering_method: 'Automatic'
    });
    setOpenModal(true);
  };

  const handleOpenEdit = (voucherType) => {
    setSelectedVoucherType(voucherType);
    reset({
      name: voucherType.name,
      prefix: voucherType.prefix,
      numbering_method: voucherType.numbering_method
    });
    setOpenModal(true);
  };

  const handleDelete = async (voucherType) => {
    if (voucherType.is_system) {
      setError('System voucher types cannot be deleted.');
      return;
    }
    
    if (window.confirm(`Are you sure you want to delete voucher configuration '${voucherType.name}'?`)) {
      try {
        await apiClient.delete(`/accounts/vouchers/types/${voucherType.id}`);
        loadVoucherTypes();
      } catch (err) {
        setError(err.response?.data?.detail || 'Failed to delete voucher type.');
      }
    }
  };

  const onSubmit = async (data) => {
    try {
      const payload = {
        name: data.name,
        prefix: data.prefix.toUpperCase(),
        numbering_method: data.numbering_method
      };

      if (selectedVoucherType) {
        await apiClient.put(`/accounts/vouchers/types/${selectedVoucherType.id}`, payload);
      } else {
        await apiClient.post('/accounts/vouchers/types', payload);
      }
      setOpenModal(false);
      loadVoucherTypes();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to save voucher configuration.');
    }
  };

  const columns = [
    { id: 'name', label: 'Voucher Name' },
    {
      id: 'prefix',
      label: 'Prefix Code',
      render: (row) => (
        <Typography variant="body2" sx={{ fontFamily: 'monospace', fontWeight: 700, color: 'primary.main' }}>
          {row.prefix}
        </Typography>
      )
    },
    { id: 'numbering_method', label: 'Numbering Method' },
    {
      id: 'is_system',
      label: 'Type',
      render: (row) => (
        <Chip
          size="small"
          label={row.is_system ? 'System Default' : 'Custom'}
          color={row.is_system ? 'primary' : 'secondary'}
          variant={row.is_system ? 'contained' : 'outlined'}
          sx={{ fontWeight: 700, fontSize: '0.725rem' }}
        />
      )
    }
  ];

  const actions = [
    { type: 'edit', label: 'Edit Configuration', onClick: handleOpenEdit },
    {
      type: 'deactivate', // Reusing the deactivate icon (block icon) for deletion representation or custom click
      label: 'Delete Configuration',
      condition: (row) => !row.is_system,
      onClick: handleDelete,
      color: 'error'
    }
  ];

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <VoucherIcon sx={{ color: 'primary.main', fontSize: 32 }} />
          <Typography variant="h5" sx={{ fontWeight: 800, color: '#1b4332' }}>
            Voucher Configurations
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<AddIcon />} onClick={handleOpenAdd}>
          Add Custom Voucher
        </Button>
      </Box>

      {error && (
        <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      <CommonTable
        columns={columns}
        rows={voucherTypes}
        actions={actions}
        searchKey="name"
        searchPlaceholder="Search voucher configurations..."
      />

      <CommonModal
        open={openModal}
        onClose={() => setOpenModal(false)}
        title={selectedVoucherType ? 'Edit Voucher Configuration' : 'Add New Voucher Configuration'}
      >
        <form onSubmit={handleSubmit(onSubmit)}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <FormInput
              name="name"
              control={control}
              label="Voucher Name (e.g. GST Sales)"
              disabled={selectedVoucherType?.is_system}
            />
            {selectedVoucherType?.is_system && (
              <Typography variant="caption" color="textSecondary" sx={{ mt: -1, mb: 1, display: 'block' }}>
                System default voucher names cannot be renamed.
              </Typography>
            )}

            <FormInput
              name="prefix"
              control={control}
              label="Voucher Prefix Code (e.g. GSTSL)"
            />

            <FormInput
              name="numbering_method"
              control={control}
              label="Numbering Method"
              type="select"
              options={[
                { value: 'Automatic', label: 'Automatic (Sequential)' },
                { value: 'Manual', label: 'Manual Input' }
              ]}
            />
          </Box>
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, mt: 3 }}>
            <Button onClick={() => setOpenModal(false)} variant="outlined">
              Cancel
            </Button>
            <Button type="submit" variant="contained">
              Save Configuration
            </Button>
          </Box>
        </form>
      </CommonModal>
    </Box>
  );
};

export default VoucherTypes;
