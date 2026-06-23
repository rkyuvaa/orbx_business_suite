import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import {
  Box, Button, Alert, Paper, Typography, CircularProgress, Divider,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField
} from '@mui/material';
import { Save as SaveIcon, CloudUpload as UploadIcon } from '@mui/icons-material';

import apiClient from '../../api/client';
import PageHeader from '../../components/PageHeader';
import FormInput from '../../components/FormInput';



const schema = yup.object().shape({
  name: yup.string().required('Company name is required'),
  gstin: yup.string().required('GSTIN is required').max(15, 'GSTIN cannot exceed 15 chars'),
  state_code: yup.string().nullable().max(10, 'State code cannot exceed 10 chars'),
  email: yup.string().email('Please enter a valid email').required('Email is required'),
  phone: yup.string().required('Phone number is required'),
  address: yup.string().required('Company address is required'),
  financial_year_start: yup.string().required('FY Start date is required'),
  smtp_host: yup.string().nullable(),
  smtp_port: yup.number().nullable().transform((value) => (isNaN(value) ? null : value)).typeError('SMTP Port must be a number'),
  smtp_user: yup.string().nullable(),
  smtp_password: yup.string().nullable(),
  email_from: yup.string().email('Please enter a valid sender email').nullable(),
  email_subject_template: yup.string().nullable(),
  email_body_template: yup.string().nullable(),
});

const CompanyConfig = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [logoUrl, setLogoUrl] = useState('');
  const [uploadingLogo, setUploadingLogo] = useState(false);

  // SMTP test state variables
  const [openTestModal, setOpenTestModal] = useState(false);
  const [testRecipient, setTestRecipient] = useState('');
  const [testingSmtp, setTestingSmtp] = useState(false);
  const [testSuccess, setTestSuccess] = useState(null);
  const [testError, setTestError] = useState(null);

  const { control, handleSubmit, reset, getValues } = useForm({
    resolver: yupResolver(schema),
  });

  const loadCompany = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get('/admin/company');
      reset(res.data);
      setLogoUrl(res.data.logo || '');
    } catch (err) {
      setError('Failed to load company configurations.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCompany();
  }, []);

  const handleLogoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Selected file must be an image.');
      return;
    }

    try {
      setUploadingLogo(true);
      setError(null);
      setSuccess(false);

      const formData = new FormData();
      formData.append('file', file);

      const res = await apiClient.post('/admin/company/logo', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      setLogoUrl(res.data.logo || '');
      setSuccess(true);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to upload logo.');
    } finally {
      setUploadingLogo(false);
    }
  };

  const onSubmit = async (data) => {
    try {
      setSaving(true);
      setSuccess(false);
      setError(null);
      // Exclude logo from regular update payload to avoid overwriting with path string
      const { logo, ...updateData } = data;
      await apiClient.put('/admin/company', updateData);
      setSuccess(true);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to save configurations.');
    } finally {
      setSaving(false);
    }
  };

  const handleTestSmtp = () => {
    const values = getValues();
    if (!values.smtp_host || !values.smtp_user || !values.smtp_password || !values.email_from) {
      setError('Please fill in SMTP Host, Username, Password, and Sender Email to run the test.');
      return;
    }
    setTestSuccess(null);
    setTestError(null);
    setTestRecipient('');
    setOpenTestModal(true);
  };

  const submitTestEmail = async () => {
    if (!testRecipient) return;
    setTestingSmtp(true);
    setTestSuccess(null);
    setTestError(null);
    try {
      const values = getValues();
      await apiClient.post('/admin/company/test-email', {
        smtp_host: values.smtp_host,
        smtp_port: parseInt(values.smtp_port) || 587,
        smtp_user: values.smtp_user,
        smtp_password: values.smtp_password,
        email_from: values.email_from,
        recipient_email: testRecipient,
      });
      setTestSuccess(`Test email sent successfully to ${testRecipient}!`);
    } catch (err) {
      setTestError(err.response?.data?.detail || 'SMTP connection/delivery failed.');
    } finally {
      setTestingSmtp(false);
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

        {/* Company Logo Upload & Preview Section */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 3, mb: 4, p: 2.5, border: '1px dashed #cbd5e1', borderRadius: '8px', backgroundColor: '#f8fafc' }}>
          <Box sx={{ position: 'relative', width: 120, height: 120, border: '1px solid #cbd5e1', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#ffffff', overflow: 'hidden', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.02)' }}>
            {logoUrl ? (
              <img src={logoUrl} alt="Company Logo" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', padding: '4px' }} />
            ) : (
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 500 }}>No Logo Set</Typography>
            )}
          </Box>
          <Box>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5, color: '#334155' }}>Company Logo</Typography>
            <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1.5, lineHeight: 1.3 }}>
              Recommended: Horizontal layout, transparent PNG background.<br />
              This logo will automatically appear on all printouts (Invoices, Challans, Receipts, Statements).
            </Typography>
            <Button
              variant="outlined"
              component="label"
              size="small"
              startIcon={<UploadIcon />}
              disabled={uploadingLogo}
              sx={{ textTransform: 'none', fontWeight: 600 }}
            >
              {uploadingLogo ? 'Uploading...' : 'Upload Logo'}
              <input
                type="file"
                hidden
                accept="image/*"
                onChange={handleLogoUpload}
              />
            </Button>
          </Box>
        </Box>

        <form onSubmit={handleSubmit(onSubmit)}>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 3 }}>
            <FormInput name="name" control={control} label="Company Name" />
            <FormInput name="gstin" control={control} label="GSTIN Number (Tax Identifier)" />
            <FormInput name="state_code" control={control} label="Default State Code (e.g. 33)" />
            <FormInput name="email" control={control} label="Official Corporate Email" type="email" />
            <FormInput name="phone" control={control} label="Corporate Phone Number" />
            <FormInput name="financial_year_start" control={control} label="Financial Year Start Date (YYYY-MM-DD)" />
            
            <Box sx={{ gridColumn: 'span 2' }}>
              <FormInput name="address" control={control} label="Registered Head Office Address" type="textarea" rows={3} />
            </Box>
          </Box>

          <Divider sx={{ my: 4 }} />

          <Typography variant="h6" color="primary.main" sx={{ fontWeight: 600, mb: 1 }}>
            SMTP Email Configuration
          </Typography>
          <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 3 }}>
            Configure SMTP credentials to send transactional PDFs directly to customer emails.
          </Typography>

          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 3, mb: 2 }}>
            <FormInput name="smtp_host" control={control} label="SMTP Host (e.g. smtp.gmail.com)" />
            <FormInput name="smtp_port" control={control} label="SMTP Port (e.g. 587)" type="number" />
            <FormInput name="smtp_user" control={control} label="SMTP Username / Email" />
            <FormInput name="smtp_password" control={control} label="SMTP Password" type="password" />
            <Box sx={{ gridColumn: { xs: 'span 1', sm: 'span 2' } }}>
              <FormInput name="email_from" control={control} label="Sender Email Address (From Address)" type="email" />
            </Box>
          </Box>

          <Box sx={{ display: 'flex', mb: 4 }}>
            <Button
              variant="outlined"
              color="secondary"
              onClick={handleTestSmtp}
              sx={{ textTransform: 'none', fontWeight: 600 }}
            >
              Test SMTP Configuration
            </Button>
          </Box>

          <Divider sx={{ my: 4 }} />

          <Typography variant="h6" color="primary.main" sx={{ fontWeight: 600, mb: 1 }}>
            Invoice Email Template Settings
          </Typography>
          <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 3 }}>
            Customize the default subject and message pre-filled when sending emails. Available placeholders: 
            <strong style={{ color: '#4f46e5' }}> &#123;invoice_number&#125;</strong>, 
            <strong style={{ color: '#4f46e5' }}> &#123;customer_name&#125;</strong>, 
            <strong style={{ color: '#4f46e5' }}> &#123;company_name&#125;</strong>, 
            <strong style={{ color: '#4f46e5' }}> &#123;invoice_date&#125;</strong>, 
            <strong style={{ color: '#4f46e5' }}> &#123;amount_due&#125;</strong>.
          </Typography>

          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr', gap: 3 }}>
            <FormInput name="email_subject_template" control={control} label="Default Email Subject Template" />
            <FormInput name="email_body_template" control={control} label="Default Email Message Template" type="textarea" rows={6} />
          </Box>

          <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 5 }}>
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

        {/* SMTP CONNECTION TEST MODAL */}
        <Dialog
          open={openTestModal}
          onClose={() => !testingSmtp && setOpenTestModal(false)}
          maxWidth="xs"
          fullWidth
          PaperProps={{
            sx: {
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
              border: '1px solid rgba(255,255,255,0.08)',
              boxShadow: '0 25px 50px rgba(0,0,0,0.5)'
            }
          }}
        >
          <DialogTitle sx={{ borderBottom: '1px solid rgba(255,255,255,0.08)', pb: 2, color: '#f1f5f9', fontWeight: 600 }}>
            Test SMTP Connection
          </DialogTitle>
          <DialogContent sx={{ pt: 3, pb: 1 }}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {testError && <Alert severity="error" sx={{ borderRadius: '8px' }}>{testError}</Alert>}
              {testSuccess && <Alert severity="success" sx={{ borderRadius: '8px' }}>{testSuccess}</Alert>}
              
              <Typography variant="body2" sx={{ color: '#94a3b8', mb: 1 }}>
                Enter a recipient email address to send a test message using your current SMTP form configurations.
              </Typography>
              
              <TextField
                id="test-recipient"
                label="Recipient Email"
                fullWidth
                size="small"
                value={testRecipient}
                onChange={(e) => setTestRecipient(e.target.value)}
                placeholder="test@example.com"
                sx={{
                  '& .MuiOutlinedInput-root': { color: '#f1f5f9', '& fieldset': { borderColor: 'rgba(255,255,255,0.15)' } },
                  '& .MuiInputLabel-root': { color: '#94a3b8' }
                }}
              />
            </Box>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2.5, pt: 1, gap: 1 }}>
            <Button
              onClick={() => setOpenTestModal(false)}
              disabled={testingSmtp}
              variant="outlined"
              sx={{ color: '#94a3b8', borderColor: 'rgba(255,255,255,0.15)' }}
            >
              Close
            </Button>
            <Button
              onClick={submitTestEmail}
              disabled={testingSmtp || !testRecipient}
              variant="contained"
              sx={{
                background: 'linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)',
                '&:hover': { background: 'linear-gradient(135deg, #4338ca 0%, #4f46e5 100%)' }
              }}
            >
              {testingSmtp ? 'Testing...' : 'Send Test Email'}
            </Button>
          </DialogActions>
        </Dialog>
      </Paper>
    </Box>
  );
};

export default CompanyConfig;
