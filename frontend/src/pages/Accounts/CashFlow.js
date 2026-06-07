import React, { useState, useEffect } from 'react';
import {
  Box, Button, Alert, Typography, Grid, TextField, Paper,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  CircularProgress, ToggleButton, ToggleButtonGroup
} from '@mui/material';
import { FileDownload as ExportIcon } from '@mui/icons-material';

import apiClient from '../../api/client';
import PageHeader from '../../components/PageHeader';

const CashFlow = () => {
  const [data, setData] = useState(null);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [method, setMethod] = useState('indirect');
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
      const res = await apiClient.get('/reports/cash-flow', {
        params: {
          start_date: startDate,
          end_date: endDate,
          method: method
        }
      });
      setData(res.data);
    } catch (err) {
      setError('Failed to fetch Cash Flow report.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (startDate && endDate) {
      loadReport();
    }
  }, [startDate, endDate, method]);

  const handleExportExcel = async () => {
    if (!startDate || !endDate) return;
    try {
      const response = await apiClient.get('/reports/cash-flow', {
        params: {
          start_date: startDate,
          end_date: endDate,
          method: method,
          format: 'xlsx'
        },
        responseType: 'blob'
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Cash_Flow_${method}_${startDate}_to_${endDate}.xlsx`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      setError('Failed to export Cash Flow to Excel.');
    }
  };

  const formatCurrency = (val) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2
    }).format(val || 0);
  };

  const handleMethodChange = (event, newMethod) => {
    if (newMethod !== null) {
      setMethod(newMethod);
    }
  };

  return (
    <Box>
      <PageHeader
        title="AS-3 Cash Flow Statement"
        breadcrumbs={[
          { label: 'Dashboard', to: '/' },
          { label: 'Accounts', to: '/accounts/chart-of-accounts' },
          { label: 'Cash Flow' },
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

      {/* Date & Method Filter */}
      <Paper sx={{ p: 3, mb: 3, borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
        <Grid container spacing={3} alignItems="center">
          <Grid item xs={12} sm={3}>
            <ToggleButtonGroup
              color="primary"
              value={method}
              exclusive
              onChange={handleMethodChange}
              fullWidth
              size="medium"
            >
              <ToggleButton value="indirect" sx={{ textTransform: 'none', fontWeight: 600 }}>
                Indirect Method
              </ToggleButton>
              <ToggleButton value="direct" sx={{ textTransform: 'none', fontWeight: 600 }}>
                Direct Method
              </ToggleButton>
            </ToggleButtonGroup>
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
          <Grid item xs={12} sm={3}>
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
              {loading ? <CircularProgress size={24} color="inherit" /> : 'Fetch Cash Flow'}
            </Button>
          </Grid>
        </Grid>
      </Paper>

      {loading || !data ? (
        <Paper sx={{ py: 6, display: 'flex', justifyContent: 'center', borderRadius: '12px' }}>
          {loading ? (
            <CircularProgress size={36} sx={{ color: '#1b4332' }} />
          ) : (
            <Typography color="text.secondary">Enter date parameters to load the Cash Flow statement.</Typography>
          )}
        </Paper>
      ) : (
        <Paper sx={{ borderRadius: '12px', overflow: 'hidden', boxShadow: '0 4px 12px rgba(0,0,0,0.05)', mb: 3 }}>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ backgroundColor: '#1b4332', color: '#ffffff', fontWeight: 600 }}>
                    Cash Flow Activities & Line Items
                  </TableCell>
                  <TableCell align="right" sx={{ backgroundColor: '#1b4332', color: '#ffffff', fontWeight: 600, width: 250 }}>
                    Amount (INR)
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {/* 1. Operating Activities */}
                <TableRow sx={{ backgroundColor: '#f1f5f9' }}>
                  <TableCell colSpan={2} sx={{ fontWeight: 800, py: 1.2 }}>
                    A. Cash Flow from Operating Activities
                  </TableCell>
                </TableRow>
                {method === 'indirect' ? (
                  <>
                    <TableRow hover>
                      <TableCell sx={{ pl: 4 }}>Net Profit before Tax</TableCell>
                      <TableCell align="right">{formatCurrency(data.operating_activities.net_profit_before_tax)}</TableCell>
                    </TableRow>
                    <TableRow hover>
                      <TableCell sx={{ pl: 4, fontStyle: 'italic', color: 'text.secondary' }}>Adjustments for:</TableCell>
                      <TableCell align="right" />
                    </TableRow>
                    <TableRow hover>
                      <TableCell sx={{ pl: 6 }}>Depreciation & Amortization</TableCell>
                      <TableCell align="right">{formatCurrency(data.operating_activities.adjustments.depreciation_amortization)}</TableCell>
                    </TableRow>
                    <TableRow hover>
                      <TableCell sx={{ pl: 6 }}>Finance Costs</TableCell>
                      <TableCell align="right">{formatCurrency(data.operating_activities.adjustments.finance_costs)}</TableCell>
                    </TableRow>
                    <TableRow hover sx={{ fontWeight: 600 }}>
                      <TableCell sx={{ pl: 4 }}>Operating Profit before Working Capital Changes</TableCell>
                      <TableCell align="right">{formatCurrency(data.operating_activities.operating_profit_before_wc)}</TableCell>
                    </TableRow>
                    <TableRow hover>
                      <TableCell sx={{ pl: 4, fontStyle: 'italic', color: 'text.secondary' }}>Working Capital Adjustments:</TableCell>
                      <TableCell align="right" />
                    </TableRow>
                    <TableRow hover>
                      <TableCell sx={{ pl: 6 }}>Decrease / (Increase) in Receivables</TableCell>
                      <TableCell align="right" sx={{ color: data.operating_activities.wc_changes.receivables_change >= 0 ? 'success.main' : 'error.main' }}>
                        {formatCurrency(data.operating_activities.wc_changes.receivables_change)}
                      </TableCell>
                    </TableRow>
                    <TableRow hover>
                      <TableCell sx={{ pl: 6 }}>Increase / (Decrease) in Payables</TableCell>
                      <TableCell align="right" sx={{ color: data.operating_activities.wc_changes.payables_change >= 0 ? 'success.main' : 'error.main' }}>
                        {formatCurrency(data.operating_activities.wc_changes.payables_change)}
                      </TableCell>
                    </TableRow>
                    <TableRow hover>
                      <TableCell sx={{ pl: 6 }}>Decrease / (Increase) in Inventory</TableCell>
                      <TableCell align="right" sx={{ color: data.operating_activities.wc_changes.inventory_change >= 0 ? 'success.main' : 'error.main' }}>
                        {formatCurrency(data.operating_activities.wc_changes.inventory_change)}
                      </TableCell>
                    </TableRow>
                  </>
                ) : (
                  <>
                    <TableRow hover>
                      <TableCell sx={{ pl: 4 }}>Cash Receipts from Customers</TableCell>
                      <TableCell align="right" sx={{ color: 'success.main' }}>{formatCurrency(data.operating_activities.cash_receipts)}</TableCell>
                    </TableRow>
                    <TableRow hover>
                      <TableCell sx={{ pl: 4 }}>Cash Payments to Suppliers / Employees</TableCell>
                      <TableCell align="right" sx={{ color: 'error.main' }}>-{formatCurrency(data.operating_activities.cash_payments)}</TableCell>
                    </TableRow>
                  </>
                )}
                <TableRow hover sx={{ backgroundColor: '#f8fafc', fontWeight: 700 }}>
                  <TableCell sx={{ pl: 4, color: 'primary.dark' }}>Net Cash generated from Operating Activities</TableCell>
                  <TableCell align="right" sx={{ color: 'primary.dark' }}>
                    {formatCurrency(data.operating_activities.net_cash_operating)}
                  </TableCell>
                </TableRow>

                {/* 2. Investing Activities */}
                <TableRow sx={{ backgroundColor: '#f1f5f9' }}>
                  <TableCell colSpan={2} sx={{ fontWeight: 800, py: 1.2 }}>
                    B. Cash Flow from Investing Activities
                  </TableCell>
                </TableRow>
                <TableRow hover>
                  <TableCell sx={{ pl: 4 }}>Sale / (Purchase) of Fixed Assets</TableCell>
                  <TableCell align="right" sx={{ color: data.investing_activities.fixed_assets_change >= 0 ? 'success.main' : 'error.main' }}>
                    {formatCurrency(data.investing_activities.fixed_assets_change)}
                  </TableCell>
                </TableRow>
                <TableRow hover>
                  <TableCell sx={{ pl: 4 }}>Sale / (Purchase) of Non-Current Investments</TableCell>
                  <TableCell align="right" sx={{ color: data.investing_activities.investments_change >= 0 ? 'success.main' : 'error.main' }}>
                    {formatCurrency(data.investing_activities.investments_change)}
                  </TableCell>
                </TableRow>
                <TableRow hover sx={{ backgroundColor: '#f8fafc', fontWeight: 700 }}>
                  <TableCell sx={{ pl: 4, color: 'primary.dark' }}>Net Cash used in Investing Activities</TableCell>
                  <TableCell align="right" sx={{ color: 'primary.dark' }}>
                    {formatCurrency(data.investing_activities.net_cash_investing)}
                  </TableCell>
                </TableRow>

                {/* 3. Financing Activities */}
                <TableRow sx={{ backgroundColor: '#f1f5f9' }}>
                  <TableCell colSpan={2} sx={{ fontWeight: 800, py: 1.2 }}>
                    C. Cash Flow from Financing Activities
                  </TableCell>
                </TableRow>
                {method === 'indirect' ? (
                  <>
                    <TableRow hover>
                      <TableCell sx={{ pl: 4 }}>Proceeds from Share Capital</TableCell>
                      <TableCell align="right">{formatCurrency(data.financing_activities.capital_change)}</TableCell>
                    </TableRow>
                    <TableRow hover>
                      <TableCell sx={{ pl: 4 }}>Proceeds from Long-Term Borrowings</TableCell>
                      <TableCell align="right">{formatCurrency(data.financing_activities.borrowings_change)}</TableCell>
                    </TableRow>
                    <TableRow hover>
                      <TableCell sx={{ pl: 4 }}>Finance Costs Paid</TableCell>
                      <TableCell align="right" sx={{ color: 'error.main' }}>{formatCurrency(data.financing_activities.finance_costs_paid)}</TableCell>
                    </TableRow>
                  </>
                ) : (
                  <TableRow hover>
                    <TableCell sx={{ pl: 4 }}>Capital & Borrowing Transactions (Net)</TableCell>
                    <TableCell align="right">{formatCurrency(data.financing_activities.net_cash_financing)}</TableCell>
                  </TableRow>
                )}
                <TableRow hover sx={{ backgroundColor: '#f8fafc', fontWeight: 700 }}>
                  <TableCell sx={{ pl: 4, color: 'primary.dark' }}>Net Cash from / (used in) Financing Activities</TableCell>
                  <TableCell align="right" sx={{ color: 'primary.dark' }}>
                    {formatCurrency(data.financing_activities.net_cash_financing)}
                  </TableCell>
                </TableRow>

                {/* Reconciliation */}
                <TableRow sx={{ backgroundColor: '#e2e8f0' }}>
                  <TableCell colSpan={2} sx={{ fontWeight: 800, py: 1.5 }}>
                    Cash & Cash Equivalents Reconciliation
                  </TableCell>
                </TableRow>
                <TableRow hover sx={{ fontWeight: 600 }}>
                  <TableCell sx={{ pl: 4 }}>Net Increase / (Decrease) in Cash (A + B + C)</TableCell>
                  <TableCell align="right">{formatCurrency(data.net_cash_change)}</TableCell>
                </TableRow>
                <TableRow hover>
                  <TableCell sx={{ pl: 4 }}>Cash & Cash Equivalents at Beginning of the Period</TableCell>
                  <TableCell align="right">{formatCurrency(data.cash_reconciliation.opening_balance)}</TableCell>
                </TableRow>
                <TableRow hover sx={{ fontWeight: 700, backgroundColor: '#cbd5e1' }}>
                  <TableCell sx={{ pl: 4 }}>Cash & Cash Equivalents at End of the Period</TableCell>
                  <TableCell align="right">{formatCurrency(data.cash_reconciliation.closing_balance)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}
    </Box>
  );
};

export default CashFlow;
