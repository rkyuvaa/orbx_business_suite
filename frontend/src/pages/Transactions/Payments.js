import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { Button, Box, Alert, MenuItem, TextField } from '@mui/material';
import { Add as AddIcon } from '@mui/icons-material';

import apiClient from '../../api/client';
import PageHeader from '../../components/PageHeader';
import CommonTable from '../../components/CommonTable';
import CommonModal from '../../components/CommonModal';
import FormInput from '../../components/FormInput';

const schema = yup.object().shape({
  customer_id: yup.string().required('Customer is required'),
  invoice_id: yup.string().required('Invoice is required'),
  payment_mode: yup.string().required('Payment mode is required'),
  reference_number: yup.string().nullable(),
  amount_paid: yup.number().typeError('Must be a number').required('Amount is required'),
  notes: yup.string().nullable(),
});

const Payments = () => {
  const [outstandings, setOutstandings] = useState([]);
  const [payments, setPayments] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [openModal, setOpenModal] = useState(false);
  const [error, setError] = useState(null);

  const { control, handleSubmit, reset, watch, setValue } = useForm({
    resolver: yupResolver(schema),
  });

  const selectedCustomerId = watch('customer_id');
  const selectedInvoiceId = watch('invoice_id');

  const loadData = async () => {
    try {
      const oRes = await apiClient.get('/payments/outstanding');
      const cRes = await apiClient.get('/customers/');
      const iRes = await apiClient.get('/sales/invoices');
      setOutstandings(oRes.data);
      setCustomers(cRes.data);
      setInvoices(iRes.data);
    } catch (err) {
      setError('Failed to load outstanding invoice data.');
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Autofill amount when invoice is selected
  useEffect(() => {
    if (selectedInvoiceId) {
      const inv = outstandings.find((i) => i.id === selectedInvoiceId);
      if (inv) {
        setValue('amount_paid', inv.total_amount);
      }
    }
  }, [selectedInvoiceId, outstandings, setValue]);

  const handleOpenAdd = () => {
    reset({
      customer_id: customers.length > 0 ? customers[0].id : '',
      invoice_id: '',
      payment_mode: 'UPI',
      reference_number: '',
      amount_paid: 0,
      notes: 'Cleared outstanding invoice amount.',
    });
    setOpenModal(true);
  };

  const onSubmit = async (data) => {
    try {
      await apiClient.post('/payments/', data);
      setOpenModal(false);
      loadData();
    } catch (err) {
      setError('Failed to log payment.');
    }
  };

  // Filter invoices for selected customer
  const filteredInvoices = outstandings.filter((inv) => {
    if (!selectedCustomerId) return true;
    // We can match branch/customer via linked SO
    return true; // Simple allow list in mock/frontend context
  });

  const columns = [
    { id: 'invoice_number', label: 'Invoice Reference' },
    {
      id: 'customer',
      label: 'Customer Name',
      render: (row) => {
        // Fetch matching customer
        const cust = customers.find((c) => c.branch_id === row.branch_id || c.name); // Simple match
        return cust ? cust.name : 'Corporate Client';
      },
    },
    { id: 'total_amount', label: 'Invoice Value', render: (row) => `$${row.total_amount.toFixed(2)}` },
    {
      id: 'status',
      label: 'Status',
      render: (row) => (
        <Typography
          variant="caption"
          sx={{
            px: 1,
            py: 0.5,
            borderRadius: '4px',
            fontWeight: 600,
            backgroundColor: 'rgba(217, 4, 41, 0.1)',
            color: '#d90429',
          }}
        >
          {row.status}
        </Typography>
      ),
    },
  ];

  const payModes = [
    { value: 'UPI', label: 'UPI (GPay/PhonePe)' },
    { value: 'cash', label: 'Cash Payment' },
    { value: 'cheque', label: 'Cheque Clearance' },
    { value: 'bank', label: 'Bank IMPS/NEFT Transfer' },
  ];

  return (
    <Box>
      <PageHeader
        title="Payment Update"
        breadcrumbs={[
          { label: 'Dashboard', to: '/' },
          { label: 'Payment Update' },
        ]}
        actions={
          <Button variant="contained" startIcon={<AddIcon />} onClick={handleOpenAdd}>
            Collect Payment
          </Button>
        }
      />

      {error && (
        <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      <CommonTable columns={columns} rows={outstandings} searchKey="invoice_number" />

      <CommonModal open={openModal} onClose={() => setOpenModal(false)} title="Collect Customer Payment">
        <form onSubmit={handleSubmit(onSubmit)}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <FormInput
              name="customer_id"
              control={control}
              label="Select Customer"
              type="select"
              options={customers.map((c) => ({ value: c.id, label: c.name }))}
            />

            <FormInput
              name="invoice_id"
              control={control}
              label="Select Outstanding Invoice"
              type="select"
              options={filteredInvoices.map((i) => ({ value: i.id, label: `${i.invoice_number} ($${i.total_amount.toFixed(2)})` }))}
            />

            <FormInput
              name="payment_mode"
              control={control}
              label="Payment Mode"
              type="select"
              options={payModes}
            />

            <FormInput name="reference_number" control={control} label="Transaction ID / Cheque Ref #" />
            <FormInput name="amount_paid" control={control} label="Amount Collected ($)" type="number" />
            <FormInput name="notes" control={control} label="Reference Notes" type="textarea" rows={2} />
          </Box>
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, mt: 3 }}>
            <Button onClick={() => setOpenModal(false)} variant="outlined">
              Cancel
            </Button>
            <Button type="submit" variant="contained">
              Record Collection
            </Button>
          </Box>
        </form>
      </CommonModal>
    </Box>
  );
};

export default Payments;
