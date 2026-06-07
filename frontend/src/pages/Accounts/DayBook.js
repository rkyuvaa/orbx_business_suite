import React, { useState, useEffect } from 'react';
import {
  Box, Button, Alert, Typography, Grid, TextField, Paper, MenuItem,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TableFooter,
  CircularProgress, Chip
} from '@mui/material';
import { FileDownload as ExportIcon, CalendarToday as DayIcon } from '@mui/icons-material';

import apiClient from '../../api/client';
import PageHeader from '../../components/PageHeader';

const DayBook = () => {
  const [branches, setBranches] = useState([]);
  const [selectedBranchId, setSelectedBranchId] = useState('');
  const [data, setData] = useState(null);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [branchesLoading, setBranchesLoading] = useState(false);
  const [error, setError] = useState(null);

  // Initialize dates and load branches
  useEffect(() => {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    setStartDate(todayStr);
    setEndDate(todayStr);

    const loadBranchesList = async () => {
      setBranchesLoading(true);
      try {
        const res = await apiClient.get('/admin/branches');
        setBranches(res.data);
      } catch (err) {
        setError('Failed to load branches.');
      } finally {
        setBranchesLoading(false);
      }
    };
    loadBranchesList();
  }, []);

  const loadReport = async () => {
    if (!startDate || !endDate) return;
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get('/reports/day-book', {
        params: {
          start_date: startDate,
          end_date: endDate,
          branch_id: selectedBranchId || undefined,
          limit: 1000
        }
      });
      setData(res.data);
    } catch (err) {
      setError('Failed to fetch Day Book entries.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (startDate && endDate) {
      loadReport();
    }
  }, [startDate, endDate, selectedBranchId]);

  const handleExportExcel = async () => {
    if (!startDate || !endDate) return;
    try {
      const response = await apiClient.get('/reports/day-book', {
        params: {
          start_date: startDate,
          end_date: endDate,
          branch_id: selectedBranchId || undefined,
          format: 'xlsx'
        },
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Day_Book_${startDate}_to_${endDate}.xlsx`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      setError('Failed to export Day Book to Excel.');
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
        title="Day Book"
        breadcrumbs={[
          { label: 'Dashboard', to: '/' },
          { label: 'Accounts', to: '/accounts/chart-of-accounts' },
          { label: 'Day Book' },
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

      {/* Date & Branch Filters */}
      <Paper sx={{ p: 3, mb: 3, borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
        <Grid container spacing={3} alignItems="center">
          <Grid item xs={12} sm={4}>
            <TextField
              select
              label="Filter by Branch"
              fullWidth
              value={selectedBranchId}
              onChange={(e) => setSelectedBranchId(e.target.value)}
              disabled={branchesLoading}
            >
              <MenuItem value="">All Branches</MenuItem>
              {branches.map((b) => (
                <MenuItem key={b.id} value={b.id}>
                  {b.branch_name} ({b.code})
                </MenuItem>
              ))}
            </TextField>
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
              {loading ? <CircularProgress size={24} color="inherit" /> : 'Fetch Day Book'}
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
                <TableCell sx={{ backgroundColor: '#1b4332', color: '#ffffff', fontWeight: 600, minWidth: 250 }}>Ledger Code & Name</TableCell>
                <TableCell align="center" sx={{ backgroundColor: '#1b4332', color: '#ffffff', fontWeight: 600, minWidth: 80 }}>Dr/Cr</TableCell>
                <TableCell align="right" sx={{ backgroundColor: '#1b4332', color: '#ffffff', fontWeight: 600, minWidth: 120 }}>Debit (₹)</TableCell>
                <TableCell align="right" sx={{ backgroundColor: '#1b4332', color: '#ffffff', fontWeight: 600, minWidth: 120 }}>Credit (₹)</TableCell>
                <TableCell sx={{ backgroundColor: '#1b4332', color: '#ffffff', fontWeight: 600, minWidth: 200 }}>Line Narration</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading || !data ? (
                <TableRow>
                  <TableCell colSpan={5} align="center" sx={{ py: 6 }}>
                    {loading ? (
                      <CircularProgress size={36} sx={{ color: '#1b4332' }} />
                    ) : (
                      <Typography color="text.secondary">Enter date filters to fetch Day Book transactions.</Typography>
                    )}
                  </TableCell>
                </TableRow>
              ) : data.entries.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} align="center" sx={{ py: 6 }}>
                    <Typography color="text.secondary">No transactions recorded for the selected range.</Typography>
                  </TableCell>
                </TableRow>
              ) : (
                data.entries.map((entry) => (
                  <React.Fragment key={entry.journal_entry_id}>
                    {/* Header Row for Journal Entry */}
                    <TableRow sx={{ backgroundColor: '#f1f5f9' }}>
                      <TableCell colSpan={5} sx={{ py: 1.5, borderBottom: '1px solid #cbd5e1' }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
                          <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#1b4332' }}>
                            Date: {entry.date} | {entry.voucher_type} - {entry.voucher_number}
                          </Typography>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                            {entry.narration && (
                              <Typography variant="caption" sx={{ fontStyle: 'italic', fontWeight: 600, color: '#475569' }}>
                                Narration: {entry.narration}
                              </Typography>
                            )}
                            {entry.is_reversed && (
                              <Chip
                                label="REVERSED"
                                size="small"
                                color="error"
                                variant="contained"
                                sx={{ fontWeight: 800, height: 18, fontSize: '0.625rem' }}
                              />
                            )}
                          </Box>
                        </Box>
                      </TableCell>
                    </TableRow>
                    {/* Lines Rows */}
                    {entry.lines.map((line, lIdx) => (
                      <TableRow
                        key={lIdx}
                        hover
                        sx={{
                          textDecoration: entry.is_reversed ? 'line-through' : 'none',
                          opacity: entry.is_reversed ? 0.6 : 1,
                          borderBottom: lIdx === entry.lines.length - 1 ? '2px solid #e2e8f0' : '1px solid #f1f5f9'
                        }}
                      >
                        <TableCell sx={{ pl: line.dr_cr === 'Cr' ? 6 : 3, fontWeight: 500 }}>
                          {line.dr_cr === 'Cr' ? 'To ' : ''}{line.ledger_code} - {line.ledger_name}
                        </TableCell>
                        <TableCell align="center">
                          <Chip
                            size="small"
                            label={line.dr_cr}
                            color={line.dr_cr === 'Dr' ? 'success' : 'primary'}
                            variant="outlined"
                            sx={{ height: 18, fontSize: '0.65rem', fontWeight: 700 }}
                          />
                        </TableCell>
                        <TableCell align="right" sx={{ fontWeight: line.dr_cr === 'Dr' ? 600 : 400 }}>
                          {line.dr_cr === 'Dr' ? formatCurrency(line.amount) : '-'}
                        </TableCell>
                        <TableCell align="right" sx={{ fontWeight: line.dr_cr === 'Cr' ? 600 : 400 }}>
                          {line.dr_cr === 'Cr' ? formatCurrency(line.amount) : '-'}
                        </TableCell>
                        <TableCell sx={{ color: 'text.secondary', fontStyle: 'italic', fontSize: '0.85rem' }}>
                          {line.narration || '-'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </React.Fragment>
                ))
              )}
            </TableBody>
            {data && data.entries.length > 0 && (
              <TableFooter>
                <TableRow sx={{ backgroundColor: '#e2e8f0' }}>
                  <TableCell colSpan={2} align="center" sx={{ fontWeight: 800, color: '#0f172a' }}>TOTAL</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 800, color: '#0f172a' }}>{formatCurrency(data.total_debit)}</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 800, color: '#0f172a' }}>{formatCurrency(data.total_credit)}</TableCell>
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

export default DayBook;
