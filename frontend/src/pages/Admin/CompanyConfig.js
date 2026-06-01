import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { Box, Button, Alert, Paper, Typography, CircularProgress } from '@mui/material';
import { Save as SaveIcon } from '@mui/icons-material';

import apiClient from '../../api/client';
import PageHeader from '../../components/PageHeader';
import FormInput from '../../components/FormInput';

const schema = yup.object().shape({
  name: yup.string().required('Company name is required'),
  gstin: yup.string().required('GSTIN is required').max(15, 'GSTIN cannot exceed 15 chars'),
  email: yup.string().email('Please enter a valid email').required('Email is required'),
  phone: yup.string().required('Phone number is required'),
  address: yup.string().required('Company address is required'),
  financial_year_start: yup.string().required('FY Start date is required'),
});

const CompanyConfig = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  const { control, handleSubmit, reset } = useForm({
    resolver: yupResolver(schema),
  });

  const loadCompany = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get('/admin/company');
      reset(res.data);
    } catch (err) {
      setError('Failed to load company configurations.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCompany();
  }, []);

  const onSubmit = async (data) => {
    try {
      setSaving(true);
      setSuccess(false);
      setError(null);
      await apiClient.put('/admin/company', data);
      setSuccess(true);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to save configurations.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', minHeight: '50vh', alignItems: 'center', justifyContent: 'center' }}>
        <CircularProgress color="primary" />
      </Box>
    );
  }

  return (
    <Box>
      <PageHeader
        title="Company Config"
        breadcrumbs={[
          { label: 'Dashboard', to: '/' },
          { label: 'Company Config' },
        ]}
      />

      {error && (
        <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert severity="success" onClose={() => setSuccess(false)} sx={{ mb: 3 }}>
          Company configuration settings updated successfully!
        </Alert>
      )}

      <Paper sx={{ p: 4, borderRadius: '12px' }}>
        <Typography variant="h6" color="primary.main" sx={{ fontWeight: 600, mb: 3 }}>
          Corporate Entity Details
        </Typography>

        <form onSubmit={handleSubmit(onSubmit)}>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 3 }}>
            <FormInput name="name" control={control} label="Company Name" />
            <FormInput name="gstin" control={control} label="GSTIN Number (Tax Identifier)" />
            <FormInput name="email" control={control} label="Official Corporate Email" type="email" />
            <FormInput name="phone" control={control} label="Corporate Phone Number" />
            <FormInput name="financial_year_start" control={control} label="Financial Year Start Date (YYYY-MM-DD)" />
            
            <Box sx={{ gridColumn: 'span 2' }}>
              <FormInput name="address" control={control} label="Registered Head Office Address" type="textarea" rows={3} />
            </Box>
          </Box>

          <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 4 }}>
            <Button
              type="submit"
              variant="contained"
              startIcon={<SaveIcon />}
              disabled={saving}
              sx={{ px: 4, py: 1.2 }}
            >
              {saving ? 'Saving changes...' : 'Save Settings'}
            </Button>
          </Box>
        </form>
      </Paper>
    </Box>
  );
};

export default CompanyConfig;
