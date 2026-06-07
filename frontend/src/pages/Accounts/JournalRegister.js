import React, { useState, useEffect } from 'react';
import {
  Box, Button, Alert, Typography, Grid, TextField, Paper,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TablePagination,
  CircularProgress
} from '@mui/material';
import { FileDownload as ExportIcon } from '@mui/icons-material';

import apiClient from '../../api/client';
import PageHeader from '../../components/PageHeader';

const JournalRegister = () => {
  const [records, setRecords] = useState([]);
  const [total, setTotal] = useState(0);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
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
      const res = await apiClient.get('/reports/journal-register', {
        params: {
          start_date: startDate,
          end_date: endDate,
          skip: page * rowsPerPage,
          limit: rowsPerPage
        }
      });
      setRecords(res.data.records);
      setTotal(res.data.total);
    } catch (err) {
      setError('Failed to fetch Journal Register.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (startDate && endDate) {
      loadReport();
    }
  }, [startDate, endDate, page, rowsPerPage]);

  const handleExportExcel = async () => {
    if (!startDate || !endDate) return;
    try {
      const response = await apiClient.get('/reports/journal-register', {
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
      link.setAttribute('download', `Journal_Register_${startDate}_to_${endDate}.xlsx`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      setError('Failed to export Journal Register to Excel.');
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
        title="Journal Register"
        breadcrumbs={[
          { label: 'Dashboard', to: '/' },
          { label: 'Accounts', to: '/accounts/chart-of-accounts' },
          { label: 'Journal Register' },
        ]}
        actions={
          <Button
            variant="contained"
            color="primary"
            startIcon={<ExportIcon />}
            onClick={handleExportExcel}
            disabled={records.length === 0 || loading}
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
              {loading ? <CircularProgress size={24} color="inherit" /> : 'Fetch Journal Register'}
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
                <TableCell sx={{ backgroundColor: '#1b4332', color: '#ffffff', fontWeight: 600, width: 120 }}>Date</TableCell>
                <TableCell sx={{ backgroundColor: '#1b4332', color: '#ffffff', fontWeight: 600, width: 150 }}>Voucher Details</TableCell>
                <TableCell sx={{ backgroundColor: '#1b4332', color: '#ffffff', fontWeight: 600 }}>Ledger / Particulars</TableCell>
                <TableCell align="right" sx={{ backgroundColor: '#1b4332', color: '#ffffff', fontWeight: 600, width: 150 }}>Debit (Dr)</TableCell>
                <TableCell align="right" sx={{ backgroundColor: '#1b4332', color: '#ffffff', fontWeight: 600, width: 150 }}>Credit (Cr)</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} align="center" sx={{ py: 6 }}>
                    <CircularProgress size={36} sx={{ color: '#1b4332' }} />
                  </TableCell>
                </TableRow>
              ) : records.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} align="center" sx={{ py: 6 }}>
                    <Typography color="text.secondary">No journal records found for this period.</Typography>
                  </TableCell>
                </TableRow>
              ) : (
                records.map((entry) => (
                  <React.Fragment key={entry.id}>
                    {/* Header Row for each Voucher */}
                    <TableRow sx={{ backgroundColor: '#e2e8f0' }}>
                      <TableCell sx={{ fontWeight: 800 }}>{entry.date}</TableCell>
                      <TableCell sx={{ fontWeight: 800, fontFamily: 'monospace' }}>
                        {entry.voucher_number}
                      </TableCell>
                      <TableCell colSpan={3} sx={{ fontWeight: 800 }}>
                        Type: {entry.voucher_type} {entry.narration && `| Narration: ${entry.narration}`}
                      </TableCell>
                    </TableRow>
                    
                    {/* Lines list */}
                    {entry.lines.map((line, lidx) => (
                      <TableRow hover key={lidx} sx={{ backgroundColor: '#ffffff' }}>
                        <TableCell />
                        <TableCell sx={{ color: 'text.secondary', fontSize: '0.8rem' }}>
                          [{line.ledger_code}]
                        </TableCell>
                        <TableCell sx={{ pl: line.dr_cr === 'Cr' ? 6 : 2 }}>
                          {line.dr_cr === 'Cr' ? 'To ' : ''}
                          <span style={{ fontWeight: 500 }}>{line.ledger_name}</span>
                          {line.narration && (
                            <Typography variant="caption" display="block" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                              {line.narration}
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell align="right" sx={{ fontWeight: line.dr_cr === 'Dr' ? 600 : 400 }}>
                          {line.dr_cr === 'Dr' ? formatCurrency(line.amount) : '-'}
                        </TableCell>
                        <TableCell align="right" sx={{ fontWeight: line.dr_cr === 'Cr' ? 600 : 400 }}>
                          {line.dr_cr === 'Cr' ? formatCurrency(line.amount) : '-'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </React.Fragment>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePagination
          component="div"
          count={total}
          page={page}
          onPageChange={(e, newPage) => setPage(newPage)}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={(e) => {
            setRowsPerPage(parseInt(e.target.value, 10));
            setPage(0);
          }}
          rowsPerPageOptions={[10, 25, 50, 100]}
        />
      </Paper>
    </Box>
  );
};

export default JournalRegister;
