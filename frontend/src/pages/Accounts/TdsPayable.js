import React, { useState, useEffect } from 'react';
import {
  Box, Button, Alert, Typography, Grid, TextField, Paper,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TableFooter,
  CircularProgress, Card, CardContent
} from '@mui/material';
import { FileDownload as ExportIcon, AccountBalanceWallet as TdsIcon } from '@mui/icons-material';

import apiClient from '../../api/client';
import PageHeader from '../../components/PageHeader';

const TdsPayable = () => {
  const [data, setData] = useState([]);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth() + 1;
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
  }, []);

  const loadReport = async () => {
    if (!startDate || !endDate) return;
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get('/reports/tds-payable', {
        params: {
          start_date: startDate,
          end_date: endDate
        }
      });
      setData(res.data);
    } catch (err) {
      setError('Failed to fetch TDS summary report.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (startDate && endDate) {
      loadReport();
    }
  }, [startDate, endDate]);

  const handleExportExcel = async () => {
    if (!startDate || !endDate) return;
    try {
      const response = await apiClient.get('/reports/tds-payable', {
        params: {
          start_date: startDate,
          end_date: endDate,
          format: 'xlsx'
        },
        responseType: 'blob'
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `TDS_Payable_Summary_${startDate}_to_${endDate}.xlsx`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      setError('Failed to export TDS Summary to Excel.');
    }
  };

  const formatCurrency = (val) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2
    }).format(val || 0);
  };

  const totalDeducted = data.reduce((acc, row) => acc + row.tds_amount, 0);
  const totalTaxable = data.reduce((acc, row) => acc + row.taxable_amount, 0);

  return (
    <Box>
      <PageHeader
        title="TDS Payable Summary"
        breadcrumbs={[
          { label: 'Dashboard', to: '/' },
          { label: 'Accounts', to: '/accounts/chart-of-accounts' },
          { label: 'TDS Payable' },
        ]}
        actions={
          <Button
            variant="contained"
            color="primary"
            startIcon={<ExportIcon />}
            onClick={handleExportExcel}
            disabled={data.length === 0 || loading}
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

      {/* Date Filters */}
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
              {loading ? <CircularProgress size={24} color="inherit" /> : 'Fetch TDS Summary'}
            </Button>
          </Grid>
        </Grid>
      </Paper>

      {data.length > 0 && !loading && (
        <Grid container spacing={3} sx={{ mb: 3 }}>
          <Grid item xs={12} sm={6} md={4}>
            <Card sx={{ borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
              <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Box sx={{ p: 1.5, borderRadius: '8px', backgroundColor: '#eefef6', color: 'success.main' }}>
                  <TdsIcon fontSize="large" />
                </Box>
                <Box>
                  <Typography variant="body2" color="text.secondary">Total TDS Payable</Typography>
                  <Typography variant="h5" sx={{ fontWeight: 800, color: '#0f172a' }}>{formatCurrency(totalDeducted)}</Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={4}>
            <Card sx={{ borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
              <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Box sx={{ p: 1.5, borderRadius: '8px', backgroundColor: '#eef2f6', color: 'primary.main' }}>
                  <TdsIcon fontSize="large" />
                </Box>
                <Box>
                  <Typography variant="body2" color="text.secondary">Total Taxable Outlay</Typography>
                  <Typography variant="h5" sx={{ fontWeight: 800, color: '#0f172a' }}>{formatCurrency(totalTaxable)}</Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Tabular Preview */}
      <Paper sx={{ width: '100%', overflow: 'hidden', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ backgroundColor: '#1b4332', color: '#ffffff', fontWeight: 600 }}>TDS Section</TableCell>
                <TableCell align="center" sx={{ backgroundColor: '#1b4332', color: '#ffffff', fontWeight: 600 }}>Transaction Count</TableCell>
                <TableCell align="right" sx={{ backgroundColor: '#1b4332', color: '#ffffff', fontWeight: 600 }}>Total Taxable Amount</TableCell>
                <TableCell align="center" sx={{ backgroundColor: '#1b4332', color: '#ffffff', fontWeight: 600 }}>Average TDS Rate (%)</TableCell>
                <TableCell align="right" sx={{ backgroundColor: '#1b4332', color: '#ffffff', fontWeight: 600 }}>Total TDS Deducted</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} align="center" sx={{ py: 6 }}>
                    <CircularProgress size={36} sx={{ color: '#1b4332' }} />
                  </TableCell>
                </TableRow>
              ) : data.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} align="center" sx={{ py: 6 }}>
                    <Typography color="text.secondary">No TDS records found for this period.</Typography>
                  </TableCell>
                </TableRow>
              ) : (
                data.map((row, idx) => (
                  <TableRow hover key={idx} sx={{ backgroundColor: idx % 2 === 1 ? '#f8fafc' : '#ffffff' }}>
                    <TableCell sx={{ fontWeight: 600 }}>Section {row.section}</TableCell>
                    <TableCell align="center">{row.count}</TableCell>
                    <TableCell align="right">{formatCurrency(row.taxable_amount)}</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 600 }}>{row.tds_rate.toFixed(2)}%</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 600, color: 'error.main' }}>
                      {formatCurrency(row.tds_amount)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
            {data.length > 0 && !loading && (
              <TableFooter>
                <TableRow sx={{ backgroundColor: '#e2e8f0' }}>
                  <TableCell sx={{ fontWeight: 800, color: '#0f172a' }}>TOTAL</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 800 }}>-</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 800, color: '#0f172a' }}>{formatCurrency(totalTaxable)}</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 800 }}>-</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 800, color: 'error.dark' }}>{formatCurrency(totalDeducted)}</TableCell>
                </TableRow>
              </TableFooter>
            )}
          </Table>
        </TableContainer>
      </Paper>
    </Box>
  );
};

export default TdsPayable;
