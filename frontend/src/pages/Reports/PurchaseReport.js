import React, { useState, useEffect } from 'react';
import { Box, Button, Alert, Typography, Grid, TextField, Paper } from '@mui/material';
import { FileDownload as ExportIcon } from '@mui/icons-material';

import apiClient from '../../api/client';
import PageHeader from '../../components/PageHeader';
import CommonTable from '../../components/CommonTable';

const PurchaseReport = () => {
  const [pos, setPos] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [startDate, setStartDate] = useState('2026-05-01');
  const [endDate, setEndDate] = useState('2026-06-30');
  const [error, setError] = useState(null);

  const loadReport = async () => {
    try {
      const res = await apiClient.get('/purchase/po');
      const sRes = await apiClient.get('/suppliers/');
      setPos(res.data);
      setSuppliers(sRes.data);
    } catch (err) {
      setError('Failed to fetch purchase reports.');
    }
  };

  useEffect(() => {
    loadReport();
  }, []);

  const handleExportCSV = () => {
    if (pos.length === 0) return;
    const headers = ['Order Date', 'Supplier', 'Subtotal', 'Tax Amount', 'Grand Total', 'Status'];
    const rows = pos.map((po) => {
      const s = suppliers.find((sup) => sup.id === po.supplier_id);
      return [
        new Date(po.date).toLocaleDateString(),
        s ? s.name : 'Unknown',
        po.total_amount,
        po.tax_amount,
        po.grand_total,
        po.status,
      ];
    });

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `PurchaseReport_${startDate}_to_${endDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const columns = [
    { id: 'date', label: 'Order Date', render: (row) => new Date(row.date).toLocaleDateString() },
    {
      id: 'supplier_id',
      label: 'Supplier Vendor',
      render: (row) => {
        const s = suppliers.find((sup) => sup.id === row.supplier_id);
        return s ? s.name : 'Unknown';
      },
    },
    { id: 'total_amount', label: 'Subtotal (₹)', render: (row) => `₹${row.total_amount.toFixed(2)}` },
    { id: 'tax_amount', label: 'Taxes (GST) (₹)', render: (row) => `₹${row.tax_amount.toFixed(2)}` },
    { id: 'grand_total', label: 'Total Value (₹)', render: (row) => `₹${row.grand_total.toFixed(2)}` },
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
            backgroundColor:
              row.status === 'Received' ? 'rgba(45, 106, 79, 0.1)' :
              row.status === 'Draft' ? 'rgba(100, 116, 139, 0.1)' : 'rgba(255, 143, 0, 0.1)',
            color:
              row.status === 'Received' ? '#2d6a4f' :
              row.status === 'Draft' ? '#64748b' : '#ff8f00',
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
        title="Purchase Reports"
        breadcrumbs={[
          { label: 'Dashboard', to: '/' },
          { label: 'Purchase Reports' },
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

      <CommonTable columns={columns} rows={pos} searchKey="status" />
    </Box>
  );
};

export default PurchaseReport;
