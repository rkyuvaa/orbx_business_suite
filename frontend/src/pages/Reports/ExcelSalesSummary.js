import React, { useState, useEffect } from 'react';
import {
  Box, Button, Alert, Typography, Grid, TextField, Paper,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TableFooter,
  CircularProgress
} from '@mui/material';
import { FileDownload as ExportIcon, CalendarToday as DateIcon } from '@mui/icons-material';

import apiClient from '../../api/client';
import PageHeader from '../../components/PageHeader';

const ExcelSalesSummary = () => {
  const [rows, setRows] = useState([]);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Initialize with the current month's start/end dates
  useEffect(() => {
    const today = new Date();
    const y = today.getFullYear();
    const m = today.getMonth(); // 0-indexed
    
    // First day of current month
    const start = new Date(y, m, 1);
    const startStr = start.toISOString().split('T')[0];
    
    // Last day of current month
    const end = new Date(y, m + 1, 0);
    const endStr = end.toISOString().split('T')[0];
    
    setStartDate(startStr);
    setEndDate(endStr);
  }, []);

  const loadReport = async () => {
    if (!startDate || !endDate) return;
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get('/reports/sales-summary', {
        params: {
          start_date: startDate,
          end_date: endDate
        }
      });
      setRows(res.data);
    } catch (err) {
      setError('Failed to fetch sales summary records.');
    } finally {
      setLoading(false);
    }
  };

  // Trigger load when dates are set initially
  useEffect(() => {
    if (startDate && endDate) {
      loadReport();
    }
  }, [startDate, endDate]);

  const handleExportExcel = () => {
    if (!startDate || !endDate) return;
    const url = `${apiClient.defaults.baseURL}/reports/sales-summary/excel?start_date=${startDate}&end_date=${endDate}`;
    
    // Download file
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Sales_Summary_${startDate}_to_${endDate}.xlsx`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Compute column totals
  const totals = rows.reduce(
    (acc, row) => {
      acc.taxable_value += row.taxable_value || 0;
      acc.discount += row.discount || 0;
      acc.cgst_amount += row.cgst_amount || 0;
      acc.sgst_amount += row.sgst_amount || 0;
      acc.igst_amount += row.igst_amount || 0;
      acc.total_tax += row.total_tax || 0;
      acc.total_invoice_value += row.total_invoice_value || 0;
      acc.tds_amount += row.tds_amount || 0;
      acc.outstanding_amount += row.outstanding_amount || 0;
      return acc;
    },
    {
      taxable_value: 0,
      discount: 0,
      cgst_amount: 0,
      sgst_amount: 0,
      igst_amount: 0,
      total_tax: 0,
      total_invoice_value: 0,
      tds_amount: 0,
      outstanding_amount: 0
    }
  );

  const formatCurrency = (val) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2
    }).format(val);
  };

  return (
    <Box>
      <PageHeader
        title="Excel Sales Summary"
        breadcrumbs={[
          { label: 'Dashboard', to: '/' },
          { label: 'Reports', to: '/reports/dashboard' },
          { label: 'Excel Sales Summary' },
        ]}
        actions={
          <Button
            variant="contained"
            color="primary"
            startIcon={<ExportIcon />}
            onClick={handleExportExcel}
            disabled={rows.length === 0 || loading}
            sx={{
              backgroundColor: '#1b4332',
              '&:hover': { backgroundColor: '#133024' },
              borderRadius: '8px',
              textTransform: 'none',
              fontWeight: 600
            }}
          >
            Export to Excel
          </Button>
        }
      />

      {error && (
        <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 3, borderRadius: '8px' }}>
          {error}
        </Alert>
      )}

      {/* Date Range Filters */}
      <Paper sx={{ p: 3, mb: 3, borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
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
            <Button
              variant="outlined"
              fullWidth
              onClick={loadReport}
              disabled={loading}
              sx={{
                py: 1.5,
                borderColor: '#1b4332',
                color: '#1b4332',
                borderRadius: '8px',
                textTransform: 'none',
                fontWeight: 600,
                '&:hover': {
                  borderColor: '#133024',
                  backgroundColor: 'rgba(27, 67, 50, 0.04)'
                }
              }}
            >
              {loading ? <CircularProgress size={24} color="inherit" /> : 'Fetch Summary'}
            </Button>
          </Grid>
        </Grid>
      </Paper>

      {/* Tabular Preview */}
      <Paper sx={{ width: '100%', overflow: 'hidden', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
        <TableContainer sx={{ maxHeight: 600 }}>
          <Table stickyHeader size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ backgroundColor: '#1b4332', color: '#ffffff', fontWeight: 600, minWidth: 120 }}>Invoice No.</TableCell>
                <TableCell sx={{ backgroundColor: '#1b4332', color: '#ffffff', fontWeight: 600, minWidth: 100 }}>Invoice Date</TableCell>
                <TableCell sx={{ backgroundColor: '#1b4332', color: '#ffffff', fontWeight: 600, minWidth: 100 }}>Payment Date</TableCell>
                <TableCell sx={{ backgroundColor: '#1b4332', color: '#ffffff', fontWeight: 600, minWidth: 110 }}>Payment Mode</TableCell>
                <TableCell sx={{ backgroundColor: '#1b4332', color: '#ffffff', fontWeight: 600, minWidth: 150 }}>Customer Name</TableCell>
                <TableCell sx={{ backgroundColor: '#1b4332', color: '#ffffff', fontWeight: 600, minWidth: 130 }}>GSTIN</TableCell>
                <TableCell sx={{ backgroundColor: '#1b4332', color: '#ffffff', fontWeight: 600, minWidth: 140 }}>Place of Supply</TableCell>
                <TableCell sx={{ backgroundColor: '#1b4332', color: '#ffffff', fontWeight: 600, minWidth: 110 }}>HSN/SAC</TableCell>
                <TableCell sx={{ backgroundColor: '#1b4332', color: '#ffffff', fontWeight: 600, minWidth: 180 }}>Description</TableCell>
                <TableCell align="right" sx={{ backgroundColor: '#1b4332', color: '#ffffff', fontWeight: 600, minWidth: 120 }}>Taxable Value</TableCell>
                <TableCell align="right" sx={{ backgroundColor: '#1b4332', color: '#ffffff', fontWeight: 600, minWidth: 100 }}>Discount</TableCell>
                <TableCell align="right" sx={{ backgroundColor: '#1b4332', color: '#ffffff', fontWeight: 600, minWidth: 80 }}>CGST %</TableCell>
                <TableCell align="right" sx={{ backgroundColor: '#1b4332', color: '#ffffff', fontWeight: 600, minWidth: 110 }}>CGST Amt</TableCell>
                <TableCell align="right" sx={{ backgroundColor: '#1b4332', color: '#ffffff', fontWeight: 600, minWidth: 80 }}>SGST %</TableCell>
                <TableCell align="right" sx={{ backgroundColor: '#1b4332', color: '#ffffff', fontWeight: 600, minWidth: 110 }}>SGST Amt</TableCell>
                <TableCell align="right" sx={{ backgroundColor: '#1b4332', color: '#ffffff', fontWeight: 600, minWidth: 80 }}>IGST %</TableCell>
                <TableCell align="right" sx={{ backgroundColor: '#1b4332', color: '#ffffff', fontWeight: 600, minWidth: 110 }}>IGST Amt</TableCell>
                <TableCell align="right" sx={{ backgroundColor: '#1b4332', color: '#ffffff', fontWeight: 600, minWidth: 110 }}>Total Tax</TableCell>
                <TableCell align="right" sx={{ backgroundColor: '#1b4332', color: '#ffffff', fontWeight: 600, minWidth: 130 }}>Total Invoice</TableCell>
                <TableCell align="right" sx={{ backgroundColor: '#1b4332', color: '#ffffff', fontWeight: 600, minWidth: 80 }}>TDS %</TableCell>
                <TableCell align="right" sx={{ backgroundColor: '#1b4332', color: '#ffffff', fontWeight: 600, minWidth: 110 }}>TDS Amt</TableCell>
                <TableCell align="right" sx={{ backgroundColor: '#1b4332', color: '#ffffff', fontWeight: 600, minWidth: 130 }}>Outstanding</TableCell>
                <TableCell sx={{ backgroundColor: '#1b4332', color: '#ffffff', fontWeight: 600, minWidth: 100 }}>Remarks</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={23} align="center" sx={{ py: 6 }}>
                    {loading ? (
                      <CircularProgress size={36} sx={{ color: '#1b4332' }} />
                    ) : (
                      <Typography color="text.secondary">No invoices found for the selected date range.</Typography>
                    )}
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((row, idx) => (
                  <TableRow hover key={row.id || idx} sx={{ backgroundColor: idx % 2 === 1 ? '#f8fafc' : '#ffffff' }}>
                    <TableCell sx={{ fontWeight: 500 }}>{row.invoice_number}</TableCell>
                    <TableCell>{row.invoice_date}</TableCell>
                    <TableCell>{row.payment_date || '-'}</TableCell>
                    <TableCell>{row.payment_mode || '-'}</TableCell>
                    <TableCell>{row.customer_name}</TableCell>
                    <TableCell>{row.customer_gstin || '-'}</TableCell>
                    <TableCell>{row.place_of_supply}</TableCell>
                    <TableCell>{row.hsn_code || '-'}</TableCell>
                    <TableCell>{row.product_description}</TableCell>
                    <TableCell align="right">{formatCurrency(row.taxable_value)}</TableCell>
                    <TableCell align="right">{formatCurrency(row.discount)}</TableCell>
                    <TableCell align="right">{row.cgst_pct}%</TableCell>
                    <TableCell align="right">{formatCurrency(row.cgst_amount)}</TableCell>
                    <TableCell align="right">{row.sgst_pct}%</TableCell>
                    <TableCell align="right">{formatCurrency(row.sgst_amount)}</TableCell>
                    <TableCell align="right">{row.igst_pct}%</TableCell>
                    <TableCell align="right">{formatCurrency(row.igst_amount)}</TableCell>
                    <TableCell align="right">{formatCurrency(row.total_tax)}</TableCell>
                    <TableCell align="right">{formatCurrency(row.total_invoice_value)}</TableCell>
                    <TableCell align="right">{row.tds_pct}%</TableCell>
                    <TableCell align="right">{formatCurrency(row.tds_amount)}</TableCell>
                    <TableCell align="right">{formatCurrency(row.outstanding_amount)}</TableCell>
                    <TableCell>{row.remarks}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
            {rows.length > 0 && (
              <TableFooter>
                <TableRow sx={{ backgroundColor: '#e2e8f0' }}>
                  <TableCell colSpan={9} align="center" sx={{ fontWeight: 800, color: '#0f172a' }}>TOTAL</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 800, color: '#0f172a' }}>{formatCurrency(totals.taxable_value)}</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 800, color: '#0f172a' }}>{formatCurrency(totals.discount)}</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 800, color: '#0f172a' }}>-</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 800, color: '#0f172a' }}>{formatCurrency(totals.cgst_amount)}</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 800, color: '#0f172a' }}>-</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 800, color: '#0f172a' }}>{formatCurrency(totals.sgst_amount)}</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 800, color: '#0f172a' }}>-</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 800, color: '#0f172a' }}>{formatCurrency(totals.igst_amount)}</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 800, color: '#0f172a' }}>{formatCurrency(totals.total_tax)}</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 800, color: '#0f172a' }}>{formatCurrency(totals.total_invoice_value)}</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 800, color: '#0f172a' }}>-</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 800, color: '#0f172a' }}>{formatCurrency(totals.tds_amount)}</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 800, color: '#0f172a' }}>{formatCurrency(totals.outstanding_amount)}</TableCell>
                  <TableCell sx={{ fontWeight: 800, color: '#0f172a' }}>-</TableCell>
                </TableRow>
              </TableFooter>
            )}
          </Table>
        </TableContainer>
      </Paper>
    </Box>
  );
};

export default ExcelSalesSummary;
