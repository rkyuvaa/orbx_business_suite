import React, { useState, useEffect } from 'react';
import { Button, Box, Alert, Typography, Tabs, Tab, Paper, Grid, TextField } from '@mui/material';
import { FileDownload as ExportIcon } from '@mui/icons-material';

import apiClient from '../../api/client';
import PageHeader from '../../components/PageHeader';
import CommonTable from '../../components/CommonTable';

const InventoryReport = () => {
  const [tabIndex, setTabIndex] = useState(0);
  const [stocks, setStocks] = useState([]);
  const [ledger, setLedger] = useState([]);
  const [products, setProducts] = useState([]);
  const [error, setError] = useState(null);

  const loadReport = async () => {
    try {
      const sRes = await apiClient.get('/inventory/stock');
      const lRes = await apiClient.get('/inventory/ledger');
      const pRes = await apiClient.get('/products/');
      setStocks(sRes.data);
      setLedger(lRes.data);
      setProducts(pRes.data);
    } catch (err) {
      setError('Failed to fetch inventory reports.');
    }
  };

  useEffect(() => {
    loadReport();
  }, []);

  const handleExportCSV = () => {
    if (tabIndex === 0) {
      // Export stock summary
      if (stocks.length === 0) return;
      const headers = ['SKU', 'Product Name', 'On Hand Qty', 'Valuation Price', 'Total Valuation'];
      const rows = stocks.map((row) => {
        const p = products.find((prod) => prod.id === row.product_id);
        const qty = row.qty;
        const price = p ? p.purchase_price : 0;
        return [
          p ? p.sku : 'Unknown',
          p ? p.name : 'Unknown',
          qty,
          price,
          qty * price,
        ];
      });

      const csvContent =
        'data:text/csv;charset=utf-8,' +
        [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement('a');
      link.setAttribute('href', encodedUri);
      link.setAttribute('download', 'InventoryValuationSummary.csv');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else {
      // Export ledger movements
      if (ledger.length === 0) return;
      const headers = ['Date', 'Product', 'Quantity Shift', 'Type', 'Reference Type', 'Reason'];
      const rows = ledger.map((row) => {
        const p = products.find((prod) => prod.id === row.product_id);
        return [
          new Date(row.date).toLocaleString(),
          p ? p.name : 'Unknown',
          row.qty,
          row.transaction_type,
          row.reference_type,
          row.reason || '',
        ];
      });

      const csvContent =
        'data:text/csv;charset=utf-8,' +
        [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement('a');
      link.setAttribute('href', encodedUri);
      link.setAttribute('download', 'InventoryLedgerMovements.csv');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const valuationColumns = [
    {
      id: 'sku',
      label: 'SKU Code',
      render: (row) => {
        const prod = products.find((p) => p.id === row.product_id);
        return prod ? prod.sku : 'Unknown';
      },
    },
    {
      id: 'product_id',
      label: 'Product Name',
      render: (row) => {
        const prod = products.find((p) => p.id === row.product_id);
        return prod ? prod.name : 'Unknown';
      },
    },
    { id: 'qty', label: 'On Hand Qty' },
    {
      id: 'purchase_price',
      label: 'Unit Purchase Rate (₹)',
      render: (row) => {
        const prod = products.find((p) => p.id === row.product_id);
        return prod ? `₹${prod.purchase_price.toFixed(2)}` : '₹0.00';
      },
    },
    {
      id: 'total_valuation',
      label: 'Total Asset Value (₹)',
      render: (row) => {
        const prod = products.find((p) => p.id === row.product_id);
        const val = prod ? row.qty * prod.purchase_price : 0;
        return (
          <Typography sx={{ fontWeight: 600, color: 'primary.main' }}>
            ₹{val.toFixed(2)}
          </Typography>
        );
      },
    },
  ];

  const ledgerColumns = [
    { id: 'date', label: 'Shift Date', render: (row) => new Date(row.date).toLocaleString() },
    {
      id: 'product_id',
      label: 'Product SKU',
      render: (row) => {
        const prod = products.find((p) => p.id === row.product_id);
        return prod ? prod.name : 'Unknown';
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
    { id: 'reason', label: 'Auditor Notes' },
  ];

  return (
    <Box>
      <PageHeader
        title="Inventory Reports"
        breadcrumbs={[
          { label: 'Dashboard', to: '/' },
          { label: 'Inventory Reports' },
        ]}
        actions={
          <Button variant="contained" startIcon={<ExportIcon />} onClick={handleExportCSV}>
            Export to CSV
          </Button>
        }
      />

      {error && (
        <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      <Paper sx={{ mb: 3, borderRadius: '8px' }}>
        <Tabs value={tabIndex} onChange={(e, idx) => setTabIndex(idx)} sx={{ px: 2, borderBottom: '1px solid #e2e8f0' }}>
          <Tab label="Stock Summary & Valuation" sx={{ fontWeight: 600 }} />
          <Tab label="Historical Stock Movement Ledger" sx={{ fontWeight: 600 }} />
        </Tabs>
      </Paper>

      {tabIndex === 0 ? (
        <CommonTable columns={valuationColumns} rows={stocks} searchKey="qty" />
      ) : (
        <CommonTable columns={ledgerColumns} rows={ledger} searchKey="transaction_type" />
      )}
    </Box>
  );
};

export default InventoryReport;
