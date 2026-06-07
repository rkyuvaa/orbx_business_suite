import React, { useState, useEffect } from 'react';
import {
  Box, Button, Alert, Typography, Grid, TextField, Paper, MenuItem,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TableFooter,
  CircularProgress, Chip
} from '@mui/material';
import { FileDownload as ExportIcon, TrendingUp as SalesIcon } from '@mui/icons-material';

import apiClient from '../../api/client';
import PageHeader from '../../components/PageHeader';

const SalesRegister = () => {
  const [customers, setCustomers] = useState([]);
  const [branches, setBranches] = useState([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [selectedBranchId, setSelectedBranchId] = useState('');
  const [data, setData] = useState(null);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [filtersLoading, setFiltersLoading] = useState(false);
  const [error, setError] = useState(null);

  // Initialize dates and load master lists
  useEffect(() => {
    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth() + 1; // 1-indexed
    let startYear, endYear;
    
    if (currentMonth >= 4) {
      startYear = currentYear;
      endYear = currentYear + 1;
    } else {
      startYear = currentYear - 1;
      endYear = currentYear;
    }
    
    setStartDate(`${startYear}-04-01`);
    setEndDate(`${endYear}-03-31`);

    const loadFilters = async () => {
      setFiltersLoading(true);
      try {
        const [customersRes, branchesRes] = await Promise.all([
          apiClient.get('/customers'),
          apiClient.get('/admin/branches')
        ]);
        setCustomers(customersRes.data);
        setBranches(branchesRes.data);
      } catch (err) {
        setError('Failed to load customer/branch filters.');
      } finally {
        setFiltersLoading(false);
      }
    };
    loadFilters();
  }, []);

  const loadReport = async () => {
    if (!startDate || !endDate) return;
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get('/reports/sales-register', {
        params: {
          start_date: startDate,
          end_date: endDate,
          customer_id: selectedCustomerId || undefined,
          branch_id: selectedBranchId || undefined,
          limit: 1000
        }
      });
      setData(res.data);
    } catch (err) {
      setError('Failed to fetch Sales Register entries.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (startDate && endDate) {
      loadReport();
    }
  }, [startDate, endDate, selectedCustomerId, selectedBranchId]);

  const handleExportExcel = async () => {
    if (!startDate || !endDate) return;
    try {
      const response = await apiClient.get('/reports/sales-register', {
        params: {
          start_date: startDate,
          end_date: endDate,
          customer_id: selectedCustomerId || undefined,
          branch_id: selectedBranchId || undefined,
          format: 'xlsx'
        },
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Sales_Register_${startDate}_to_${endDate}.xlsx`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      setError('Failed to export Sales Register to Excel.');
    }
  };

  const formatCurrency = (val) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2
    }).format(val || 0);
  };

  return (
    <Box>
      <PageHeader
        title="Sales Register"
        breadcrumbs={[
          { label: 'Dashboard', to: '/' },
          { label: 'Accounts', to: '/accounts/chart-of-accounts' },
          { label: 'Sales Register' },
        ]}
        actions={
          <Button
            variant="contained"
            color="primary"
            startIcon={<ExportIcon />}
            onClick={handleExportExcel}
            disabled={!data || loading}
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

      {/* Date Range, Customer, & Branch Filters */}
      <Paper sx={{ p: 3, mb: 3, borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} sm={3}>
            <TextField
              select
              label="Customer"
              fullWidth
              value={selectedCustomerId}
              onChange={(e) => setSelectedCustomerId(e.target.value)}
              disabled={filtersLoading}
            >
              <MenuItem value="">All Customers</MenuItem>
              {customers.map((c) => (
                <MenuItem key={c.id} value={c.id}>
                  {c.name}
                </MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid item xs={12} sm={3}>
            <TextField
              select
              label="Branch"
              fullWidth
              value={selectedBranchId}
              onChange={(e) => setSelectedBranchId(e.target.value)}
              disabled={filtersLoading}
            >
              <MenuItem value="">All Branches</MenuItem>
              {branches.map((b) => (
                <MenuItem key={b.id} value={b.id}>
                  {b.branch_name} ({b.code})
                </MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid item xs={12} sm={2.5}>
            <TextField
              label="Start Date"
              type="date"
              fullWidth
              InputLabelProps={{ shrink: true }}
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </Grid>
          <Grid item xs={12} sm={2.5}>
            <TextField
              label="End Date"
              type="date"
              fullWidth
              InputLabelProps={{ shrink: true }}
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </Grid>
          <Grid item xs={12} sm={1}>
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
              {loading ? <CircularProgress size={20} color="inherit" /> : 'Fetch'}
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
                <TableCell sx={{ backgroundColor: '#1b4332', color: '#ffffff', fontWeight: 600, minWidth: 100 }}>Invoice Date</TableCell>
                <TableCell sx={{ backgroundColor: '#1b4332', color: '#ffffff', fontWeight: 600, minWidth: 120 }}>Invoice No.</TableCell>
                <TableCell sx={{ backgroundColor: '#1b4332', color: '#ffffff', fontWeight: 600, minWidth: 160 }}>Customer Name</TableCell>
                <TableCell sx={{ backgroundColor: '#1b4332', color: '#ffffff', fontWeight: 600, minWidth: 130 }}>Customer GSTIN</TableCell>
                <TableCell sx={{ backgroundColor: '#1b4332', color: '#ffffff', fontWeight: 600, minWidth: 140 }}>Place of Supply</TableCell>
                <TableCell align="right" sx={{ backgroundColor: '#1b4332', color: '#ffffff', fontWeight: 600, minWidth: 120 }}>Taxable Value</TableCell>
                <TableCell align="right" sx={{ backgroundColor: '#1b4332', color: '#ffffff', fontWeight: 600, minWidth: 100 }}>CGST</TableCell>
                <TableCell align="right" sx={{ backgroundColor: '#1b4332', color: '#ffffff', fontWeight: 600, minWidth: 100 }}>SGST</TableCell>
                <TableCell align="right" sx={{ backgroundColor: '#1b4332', color: '#ffffff', fontWeight: 600, minWidth: 100 }}>IGST</TableCell>
                <TableCell align="right" sx={{ backgroundColor: '#1b4332', color: '#ffffff', fontWeight: 600, minWidth: 110 }}>Total Tax</TableCell>
                <TableCell align="right" sx={{ backgroundColor: '#1b4332', color: '#ffffff', fontWeight: 600, minWidth: 130 }}>Total Amount</TableCell>
                <TableCell sx={{ backgroundColor: '#1b4332', color: '#ffffff', fontWeight: 600, minWidth: 100 }}>Status</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading || !data ? (
                <TableRow>
                  <TableCell colSpan={12} align="center" sx={{ py: 6 }}>
                    {loading ? (
                      <CircularProgress size={36} sx={{ color: '#1b4332' }} />
                    ) : (
                      <Typography color="text.secondary">Enter date parameters to fetch the register.</Typography>
                    )}
                  </TableCell>
                </TableRow>
              ) : data.rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={12} align="center" sx={{ py: 6 }}>
                    <Typography color="text.secondary">No invoices found for the selected filter.</Typography>
                  </TableCell>
                </TableRow>
              ) : (
                data.rows.map((row, idx) => (
                  <TableRow hover key={row.invoice_id || idx} sx={{ backgroundColor: idx % 2 === 1 ? '#f8fafc' : '#ffffff' }}>
                    <TableCell>{row.invoice_date}</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>{row.invoice_number}</TableCell>
                    <TableCell sx={{ fontWeight: 500 }}>{row.customer_name}</TableCell>
                    <TableCell>{row.customer_gstin || '-'}</TableCell>
                    <TableCell>{row.place_of_supply}</TableCell>
                    <TableCell align="right">{formatCurrency(row.taxable_value)}</TableCell>
                    <TableCell align="right" sx={{ color: row.cgst_amount > 0 ? 'text.primary' : 'text.secondary' }}>
                      {row.cgst_amount > 0 ? formatCurrency(row.cgst_amount) : '-'}
                    </TableCell>
                    <TableCell align="right" sx={{ color: row.sgst_amount > 0 ? 'text.primary' : 'text.secondary' }}>
                      {row.sgst_amount > 0 ? formatCurrency(row.sgst_amount) : '-'}
                    </TableCell>
                    <TableCell align="right" sx={{ color: row.igst_amount > 0 ? 'text.primary' : 'text.secondary' }}>
                      {row.igst_amount > 0 ? formatCurrency(row.igst_amount) : '-'}
                    </TableCell>
                    <TableCell align="right">{formatCurrency(row.total_tax)}</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 600 }}>{formatCurrency(row.total_amount)}</TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        label={row.status}
                        color={row.status === 'Paid' ? 'success' : row.status === 'Unpaid' ? 'error' : 'warning'}
                        sx={{ fontWeight: 700, fontSize: '0.7rem' }}
                      />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
            {data && data.rows.length > 0 && (
              <TableFooter>
                <TableRow sx={{ backgroundColor: '#e2e8f0' }}>
                  <TableCell colSpan={5} align="center" sx={{ fontWeight: 800, color: '#0f172a' }}>TOTAL</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 800, color: '#0f172a' }}>{formatCurrency(data.totals.taxable_value_total)}</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 800, color: '#0f172a' }}>{formatCurrency(data.totals.cgst_amount_total)}</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 800, color: '#0f172a' }}>{formatCurrency(data.totals.sgst_amount_total)}</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 800, color: '#0f172a' }}>{formatCurrency(data.totals.igst_amount_total)}</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 800, color: '#0f172a' }}>{formatCurrency(data.totals.total_tax_total)}</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 800, color: '#0f172a' }}>{formatCurrency(data.totals.total_amount_total)}</TableCell>
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

export default SalesRegister;
