import React, { useState, useEffect } from 'react';
import {
  Box, Button, Alert, Typography, Grid, TextField, Paper,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  CircularProgress, Tabs, Tab
} from '@mui/material';
import { FileDownload as ExportIcon } from '@mui/icons-material';

import apiClient from '../../api/client';
import PageHeader from '../../components/PageHeader';

const GstReturns = () => {
  const [tabValue, setTabValue] = useState(0);
  const [dataGstr1, setDataGstr1] = useState(null);
  const [dataGstr3b, setDataGstr3b] = useState(null);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    // Set to current month dates
    setStartDate(`${year}-${month}-01`);
    
    // Get last day of month
    const lastDay = new Date(year, today.getMonth() + 1, 0).getDate();
    setEndDate(`${year}-${month}-${lastDay}`);
  }, []);

  const loadReports = async () => {
    if (!startDate || !endDate) return;
    setLoading(true);
    setError(null);
    try {
      if (tabValue === 0) {
        const res = await apiClient.get('/reports/gstr1', {
          params: { start_date: startDate, end_date: endDate }
        });
        setDataGstr1(res.data);
      } else {
        const res = await apiClient.get('/reports/gstr3b', {
          params: { start_date: startDate, end_date: endDate }
        });
        setDataGstr3b(res.data);
      }
    } catch (err) {
      setError('Failed to fetch GST return records.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (startDate && endDate) {
      loadReports();
    }
  }, [startDate, endDate, tabValue]);

  const handleExportExcel = async () => {
    if (!startDate || !endDate) return;
    const path = tabValue === 0 ? '/reports/gstr1' : '/reports/gstr3b';
    const filename = tabValue === 0 ? `GSTR1_${startDate}_to_${endDate}.xlsx` : `GSTR3B_${startDate}_to_${endDate}.xlsx`;
    try {
      const response = await apiClient.get(path, {
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
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      setError('Failed to export GST Return to Excel.');
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
        title="GST Compliance Center"
        breadcrumbs={[
          { label: 'Dashboard', to: '/' },
          { label: 'Accounts', to: '/accounts/chart-of-accounts' },
          { label: 'GST Returns' },
        ]}
        actions={
          <Button
            variant="contained"
            color="primary"
            startIcon={<ExportIcon />}
            onClick={handleExportExcel}
            disabled={loading || (tabValue === 0 ? !dataGstr1 : !dataGstr3b)}
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

      {/* Date Filters & Tab selector */}
      <Paper sx={{ p: 3, mb: 3, borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
        <Grid container spacing={3} alignItems="center">
          <Grid item xs={12} sm={4}>
            <Tabs
              value={tabValue}
              onChange={(e, val) => setTabValue(val)}
              textColor="primary"
              indicatorColor="primary"
              variant="fullWidth"
            >
              <Tab label="GSTR-1 (Sales)" sx={{ textTransform: 'none', fontWeight: 600 }} />
              <Tab label="GSTR-3B (Summary)" sx={{ textTransform: 'none', fontWeight: 600 }} />
            </Tabs>
          </Grid>
          <Grid item xs={12} sm={3}>
            <TextField
              label="Start Date"
              type="date"
              fullWidth
              InputLabelProps={{ shrink: true }}
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </Grid>
          <Grid item xs={12} sm={3}>
            <TextField
              label="End Date"
              type="date"
              fullWidth
              InputLabelProps={{ shrink: true }}
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </Grid>
          <Grid item xs={12} sm={2}>
            <Button
              variant="outlined"
              fullWidth
              onClick={loadReports}
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
              {loading ? <CircularProgress size={24} color="inherit" /> : 'Fetch Return'}
            </Button>
          </Grid>
        </Grid>
      </Paper>

      {/* GSTR-1 View */}
      {tabValue === 0 && (
        loading || !dataGstr1 ? (
          <Paper sx={{ py: 6, display: 'flex', justifyContent: 'center', borderRadius: '12px' }}>
            {loading ? <CircularProgress size={36} sx={{ color: '#1b4332' }} /> : <Typography color="text.secondary">Load GSTR-1 details.</Typography>}
          </Paper>
        ) : (
          <Grid container spacing={3}>
            {/* B2B Invoices */}
            <Grid item xs={12}>
              <Typography variant="h6" sx={{ mb: 1.5, fontWeight: 700, color: '#1b4332' }}>B2B Outward Supplies</Typography>
              <Paper sx={{ borderRadius: '12px', overflow: 'hidden', boxShadow: '0 4px 12px rgba(0,0,0,0.05)', mb: 3 }}>
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ backgroundColor: '#1b4332', color: '#ffffff', fontWeight: 600 }}>GSTIN</TableCell>
                        <TableCell sx={{ backgroundColor: '#1b4332', color: '#ffffff', fontWeight: 600 }}>Customer Name</TableCell>
                        <TableCell sx={{ backgroundColor: '#1b4332', color: '#ffffff', fontWeight: 600 }}>Invoice No</TableCell>
                        <TableCell sx={{ backgroundColor: '#1b4332', color: '#ffffff', fontWeight: 600 }}>Date</TableCell>
                        <TableCell align="right" sx={{ backgroundColor: '#1b4332', color: '#ffffff', fontWeight: 600 }}>Taxable Value</TableCell>
                        <TableCell align="right" sx={{ backgroundColor: '#1b4332', color: '#ffffff', fontWeight: 600 }}>Tax Amount</TableCell>
                        <TableCell align="right" sx={{ backgroundColor: '#1b4332', color: '#ffffff', fontWeight: 600 }}>Invoice Value</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {dataGstr1.b2b.invoices.length === 0 ? (
                        <TableRow><TableCell colSpan={7} align="center" sx={{ py: 2 }}>No B2B Invoices found.</TableCell></TableRow>
                      ) : (
                        dataGstr1.b2b.invoices.map((inv, idx) => (
                          <TableRow key={idx}>
                            <TableCell>{inv.gstin}</TableCell>
                            <TableCell sx={{ fontWeight: 600 }}>{inv.customer_name}</TableCell>
                            <TableCell>{inv.invoice_no}</TableCell>
                            <TableCell>{inv.date}</TableCell>
                            <TableCell align="right">{formatCurrency(inv.taxable_value)}</TableCell>
                            <TableCell align="right">{formatCurrency(inv.tax_amount)}</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 600 }}>{formatCurrency(inv.value)}</TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Paper>
            </Grid>

            {/* B2CS Invoices */}
            <Grid item xs={12} md={6}>
              <Typography variant="h6" sx={{ mb: 1.5, fontWeight: 700, color: '#1b4332' }}>B2C Small Supplies</Typography>
              <Paper sx={{ borderRadius: '12px', overflow: 'hidden', boxShadow: '0 4px 12px rgba(0,0,0,0.05)', mb: 3 }}>
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ backgroundColor: '#1b4332', color: '#ffffff', fontWeight: 600 }}>Place of Supply</TableCell>
                        <TableCell sx={{ backgroundColor: '#1b4332', color: '#ffffff', fontWeight: 600 }}>Invoice No</TableCell>
                        <TableCell align="right" sx={{ backgroundColor: '#1b4332', color: '#ffffff', fontWeight: 600 }}>Taxable Value</TableCell>
                        <TableCell align="right" sx={{ backgroundColor: '#1b4332', color: '#ffffff', fontWeight: 600 }}>Tax Amount</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {dataGstr1.b2cs.invoices.length === 0 ? (
                        <TableRow><TableCell colSpan={4} align="center" sx={{ py: 2 }}>No B2CS transactions found.</TableCell></TableRow>
                      ) : (
                        dataGstr1.b2cs.invoices.map((inv, idx) => (
                          <TableRow key={idx}>
                            <TableCell>{inv.place_of_supply}</TableCell>
                            <TableCell>{inv.invoice_no}</TableCell>
                            <TableCell align="right">{formatCurrency(inv.taxable_value)}</TableCell>
                            <TableCell align="right">{formatCurrency(inv.tax_amount)}</TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Paper>
            </Grid>

            {/* HSN summary */}
            <Grid item xs={12} md={6}>
              <Typography variant="h6" sx={{ mb: 1.5, fontWeight: 700, color: '#1b4332' }}>HSN-wise Summary</Typography>
              <Paper sx={{ borderRadius: '12px', overflow: 'hidden', boxShadow: '0 4px 12px rgba(0,0,0,0.05)', mb: 3 }}>
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ backgroundColor: '#1b4332', color: '#ffffff', fontWeight: 600 }}>HSN Code</TableCell>
                        <TableCell align="right" sx={{ backgroundColor: '#1b4332', color: '#ffffff', fontWeight: 600 }}>Qty Sold</TableCell>
                        <TableCell align="right" sx={{ backgroundColor: '#1b4332', color: '#ffffff', fontWeight: 600 }}>Total Value</TableCell>
                        <TableCell align="right" sx={{ backgroundColor: '#1b4332', color: '#ffffff', fontWeight: 600 }}>Tax Amount</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {dataGstr1.hsn_summary.length === 0 ? (
                        <TableRow><TableCell colSpan={4} align="center" sx={{ py: 2 }}>No HSN details found.</TableCell></TableRow>
                      ) : (
                        dataGstr1.hsn_summary.map((hsn, idx) => (
                          <TableRow key={idx}>
                            <TableCell sx={{ fontWeight: 600 }}>{hsn.hsn_code}</TableCell>
                            <TableCell align="right">{hsn.total_qty}</TableCell>
                            <TableCell align="right">{formatCurrency(hsn.total_value)}</TableCell>
                            <TableCell align="right">{formatCurrency(hsn.total_tax)}</TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Paper>
            </Grid>
          </Grid>
        )
      )}

      {/* GSTR-3B View */}
      {tabValue === 1 && (
        loading || !dataGstr3b ? (
          <Paper sx={{ py: 6, display: 'flex', justifyContent: 'center', borderRadius: '12px' }}>
            {loading ? <CircularProgress size={36} sx={{ color: '#1b4332' }} /> : <Typography color="text.secondary">Load GSTR-3B details.</Typography>}
          </Paper>
        ) : (
          <Paper sx={{ borderRadius: '12px', overflow: 'hidden', boxShadow: '0 4px 12px rgba(0,0,0,0.05)', mb: 3 }}>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ backgroundColor: '#1b4332', color: '#ffffff', fontWeight: 600 }}>GSTR-3B Section</TableCell>
                    <TableCell align="right" sx={{ backgroundColor: '#1b4332', color: '#ffffff', fontWeight: 600 }}>Taxable Value</TableCell>
                    <TableCell align="right" sx={{ backgroundColor: '#1b4332', color: '#ffffff', fontWeight: 600 }}>CGST</TableCell>
                    <TableCell align="right" sx={{ backgroundColor: '#1b4332', color: '#ffffff', fontWeight: 600 }}>SGST</TableCell>
                    <TableCell align="right" sx={{ backgroundColor: '#1b4332', color: '#ffffff', fontWeight: 600 }}>IGST</TableCell>
                    <TableCell align="right" sx={{ backgroundColor: '#1b4332', color: '#ffffff', fontWeight: 600 }}>Total Tax</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {/* Outward supplies */}
                  <TableRow hover>
                    <TableCell sx={{ fontWeight: 600, py: 2 }}>{dataGstr3b.section_3_1.description}</TableCell>
                    <TableCell align="right">{formatCurrency(dataGstr3b.section_3_1.taxable_value)}</TableCell>
                    <TableCell align="right">{formatCurrency(dataGstr3b.section_3_1.cgst)}</TableCell>
                    <TableCell align="right">{formatCurrency(dataGstr3b.section_3_1.sgst)}</TableCell>
                    <TableCell align="right">{formatCurrency(dataGstr3b.section_3_1.igst)}</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 600, color: 'primary.dark' }}>
                      {formatCurrency(dataGstr3b.section_3_1.total_tax)}
                    </TableCell>
                  </TableRow>

                  {/* Input tax credit */}
                  <TableRow hover>
                    <TableCell sx={{ fontWeight: 600, py: 2 }}>{dataGstr3b.section_4.description}</TableCell>
                    <TableCell align="right">{formatCurrency(dataGstr3b.section_4.taxable_value)}</TableCell>
                    <TableCell align="right">{formatCurrency(dataGstr3b.section_4.cgst)}</TableCell>
                    <TableCell align="right">{formatCurrency(dataGstr3b.section_4.sgst)}</TableCell>
                    <TableCell align="right">{formatCurrency(dataGstr3b.section_4.igst)}</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 600, color: 'success.dark' }}>
                      {formatCurrency(dataGstr3b.section_4.total_itc)}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        )
      )}
    </Box>
  );
};

export default GstReturns;
