import React, { useState, useEffect } from 'react';
import { Box, Button, Alert, Typography, Grid, TextField, Paper } from '@mui/material';
import { FileDownload as ExportIcon } from '@mui/icons-material';

import apiClient from '../../api/client';
import PageHeader from '../../components/PageHeader';
import CommonTable from '../../components/CommonTable';

const SalesReport = () => {
  const [invoices, setInvoices] = useState([]);
  const [startDate, setStartDate] = useState('2026-05-01');
  const [endDate, setEndDate] = useState('2026-06-30');
  const [error, setError] = useState(null);

  const loadReport = async () => {
    try {
      const res = await apiClient.get('/sales/invoices');
      setInvoices(res.data);
    } catch (err) {
      setError('Failed to fetch sales reports.');
    }
  };

  useEffect(() => {
    loadReport();
  }, []);

  const handleExportCSV = () => {
    if (invoices.length === 0) return;
    
    // Header columns
    const headers = ['Invoice Number', 'Date', 'Subtotal', 'Tax Amount', 'Total Value', 'Status'];
    const rows = invoices.map((inv) => [
      inv.invoice_number,
      new Date(inv.date).toLocaleDateString(),
      inv.subtotal,
      inv.tax_amount,
      inv.total_amount,
      inv.status,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
      
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `SalesReport_${startDate}_to_${endDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const columns = [
    { id: 'invoice_number', label: 'Invoice No.' },
    { id: 'date', label: 'Billing Date', render: (row) => new Date(row.date).toLocaleDateString() },
    { id: 'subtotal', label: 'Subtotal ($)', render: (row) => `$${row.subtotal.toFixed(2)}` },
    { id: 'tax_amount', label: 'Tax (GST) ($)', render: (row) => `$${row.tax_amount.toFixed(2)}` },
    { id: 'total_amount', label: 'Grand Total ($)', render: (row) => `$${row.total_amount.toFixed(2)}` },
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
            backgroundColor: row.status === 'Paid' ? 'rgba(45, 106, 79, 0.1)' : 'rgba(217, 4, 41, 0.1)',
            color: row.status === 'Paid' ? '#2d6a4f' : '#d90429',
          }}
        >
          {row.status}
        </Typography>
      ),
    },
  ];

  return (
    <Box>
      <PageHeader
        title="Sales Reports"
        breadcrumbs={[
          { label: 'Dashboard', to: '/' },
          { label: 'Sales Reports' },
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

      <Paper sx={{ p: 3, mb: 3, borderRadius: '12px' }}>
        <Grid container spacing={3} alignItems="center">
          <Grid item xs={12} sm={4}>
            <TextField
              label="Start Date"
              type="date"
              fullWidth
              InputLabelProps={{ shrink: true }}
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </Grid>
          <Grid item xs={12} sm={4}>
            <TextField
              label="End Date"
              type="date"
              fullWidth
              InputLabelProps={{ shrink: true }}
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </Grid>
          <Grid item xs={12} sm={4}>
            <Button variant="outlined" fullWidth onClick={loadReport} sx={{ py: 1.5 }}>
              Apply Date Filters
            </Button>
          </Grid>
        </Grid>
      </Paper>

      <CommonTable columns={columns} rows={invoices} searchKey="invoice_number" />
    </Box>
  );
};

export default SalesReport;
