import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { Button, Box, Alert, Typography, Tabs, Tab, Paper, Chip } from '@mui/material';
import { Add as AddIcon, Warning as WarningIcon } from '@mui/icons-material';

import apiClient from '../../api/client';
import PageHeader from '../../components/PageHeader';
import CommonTable from '../../components/CommonTable';
import CommonModal from '../../components/CommonModal';
import FormInput from '../../components/FormInput';

const schema = yup.object().shape({
  product_id: yup.string().required('Product is required'),
  branch_id: yup.string().required('Branch is required'),
  qty: yup.number().typeError('Must be a number').required('Quantity is required'),
  transaction_type: yup.string().required('Transaction type is required'),
  reason: yup.string().nullable(),
});

const Inventory = () => {
  const [tabIndex, setTabIndex] = useState(0);
  const [stockPositions, setStockPositions] = useState([]);
  const [ledger, setLedger] = useState([]);
  const [products, setProducts] = useState([]);
  const [branches, setBranches] = useState([]);
  const [openModal, setOpenModal] = useState(false);
  const [error, setError] = useState(null);

  const { control, handleSubmit, reset } = useForm({
    resolver: yupResolver(schema),
  });

  const loadData = async () => {
    try {
      const sRes = await apiClient.get('/inventory/stock');
      const lRes = await apiClient.get('/inventory/ledger');
      const pRes = await apiClient.get('/products/');
      const bRes = await apiClient.get('/admin/branches');

      setStockPositions(sRes.data);
      setLedger(lRes.data);
      setProducts(pRes.data);
      setBranches(bRes.data);
    } catch (err) {
      setError('Failed to load inventory stocks records.');
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleOpenAdjustment = () => {
    reset({
      product_id: products.length > 0 ? products[0].id : '',
      branch_id: branches.length > 0 ? branches[0].id : '',
      qty: 0,
      transaction_type: 'Adjustment',
      reason: 'Physical stock verification adjustment',
    });
    setOpenModal(true);
  };

  const onSubmit = async (data) => {
    try {
      await apiClient.post('/inventory/adjust', data);
      setOpenModal(false);
      loadData();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to submit stock adjustment.');
    }
  };

  const stockColumns = [
    {
      id: 'product_id',
      label: 'Product Name',
      render: (row) => {
        const prod = products.find((p) => p.id === row.product_id);
        return prod ? prod.name : 'Unknown';
      },
    },
    {
      id: 'sku',
      label: 'SKU Code',
      render: (row) => {
        const prod = products.find((p) => p.id === row.product_id);
        return prod ? prod.sku : 'Unknown';
      },
    },
    {
      id: 'branch_id',
      label: 'Branch Location',
      render: (row) => {
        const b = branches.find((br) => br.id === row.branch_id);
        return b ? b.branch_name : 'Global';
      },
    },
    {
      id: 'qty',
      label: 'On Hand Qty',
      render: (row) => (
        <Typography sx={{ fontWeight: 600 }}>
          {row.qty}
        </Typography>
      ),
    },
    {
      id: 'warning',
      label: 'Stock Alert',
      render: (row) => {
        const prod = products.find((p) => p.id === row.product_id);
        const low = prod ? row.qty < prod.min_stock_level : false;
        return low ? (
          <Chip
            size="small"
            icon={<WarningIcon fontSize="small" />}
            label={`Low Stock (Min: ${prod.min_stock_level})`}
            color="warning"
            sx={{ fontWeight: 600 }}
          />
        ) : (
          <Chip size="small" label="Healthy" color="success" sx={{ fontWeight: 600 }} />
        );
      },
    },
  ];

  const ledgerColumns = [
    { id: 'date', label: 'Date', render: (row) => new Date(row.date).toLocaleString() },
    {
      id: 'product_id',
      label: 'Product',
      render: (row) => {
        const prod = products.find((p) => p.id === row.product_id);
        return prod ? prod.name : 'Unknown';
      },
    },
    {
      id: 'branch_id',
      label: 'Branch',
      render: (row) => {
        const b = branches.find((br) => br.id === row.branch_id);
        return b ? b.branch_name : 'Global';
      },
    },
    {
      id: 'qty',
      label: 'Quantity Shift',
      render: (row) => (
        <Typography sx={{ color: row.qty >= 0 ? 'success.main' : 'error.main', fontWeight: 600 }}>
          {row.qty >= 0 ? `+${row.qty}` : row.qty}
        </Typography>
      ),
    },
    { id: 'transaction_type', label: 'Type' },
    { id: 'reference_type', label: 'Reference Ref' },
    { id: 'reason', label: 'Reason/Notes' },
  ];

  const productOptions = products.map((p) => ({ value: p.id, label: p.name }));
  const branchOptions = branches.map((b) => ({ value: b.id, label: b.branch_name }));
  const txTypeOptions = [
    { value: 'In', label: 'Stock In (Intake)' },
    { value: 'Out', label: 'Stock Out (Reduction)' },
    { value: 'Adjustment', label: 'Physical Adjustment (Variance Correction)' },
  ];

  return (
    <Box>
      {error && (
        <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      <Paper sx={{ mb: 3, borderRadius: '8px' }}>
        <Tabs value={tabIndex} onChange={(e, idx) => setTabIndex(idx)} sx={{ px: 2, borderBottom: '1px solid #e2e8f0' }}>
          <Tab label="Current Stock Balances" sx={{ fontWeight: 600 }} />
          <Tab label="Inventory Ledger History" sx={{ fontWeight: 600 }} />
        </Tabs>
      </Paper>

      {tabIndex === 0 ? (
        <CommonTable
          columns={stockColumns}
          rows={stockPositions}
          searchKey="qty"
          tableActions={
            <Button variant="contained" startIcon={<AddIcon />} onClick={handleOpenAdjustment}>
              Manual Stock Adjustment
            </Button>
          }
        />
      ) : (
        <CommonTable columns={ledgerColumns} rows={ledger} searchKey="transaction_type" />
      )}

      <CommonModal
        open={openModal}
        onClose={() => setOpenModal(false)}
        title="Manual Stock Balance Adjustment"
      >
        <form onSubmit={handleSubmit(onSubmit)}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <FormInput
              name="product_id"
              control={control}
              label="Select Product SKU"
              type="select"
              options={productOptions}
            />
            <FormInput
              name="branch_id"
              control={control}
              label="Select Branch Location"
              type="select"
              options={branchOptions}
            />
            <FormInput
              name="transaction_type"
              control={control}
              label="Transaction Action"
              type="select"
              options={txTypeOptions}
            />
            <FormInput
              name="qty"
              control={control}
              label="Quantity (Enter target count if Adjustment)"
              type="number"
            />
            <FormInput
              name="reason"
              control={control}
              label="Auditing Reason Note"
              type="textarea"
              rows={2}
            />
          </Box>
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, mt: 3 }}>
            <Button onClick={() => setOpenModal(false)} variant="outlined">
              Cancel
            </Button>
            <Button type="submit" variant="contained">
              Submit Stock Update
            </Button>
          </Box>
        </form>
      </CommonModal>
    </Box>
  );
};

export default Inventory;
