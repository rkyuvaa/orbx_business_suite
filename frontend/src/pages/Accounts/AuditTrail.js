import React, { useState, useEffect } from 'react';
import {
  FileDownload as ExportIcon,
  KeyboardArrowDown as ExpandMoreIcon,
  KeyboardArrowRight as ChevronRightIcon,
  History as AuditIcon
} from '@mui/icons-material';
import {
  Button as MuiButton,
  IconButton,
  Table as MuiTable,
  TableBody as MuiTableBody,
  TableCell as MuiTableCell,
  TableContainer as MuiTableContainer,
  TableHead as MuiTableHead,
  TableRow as MuiTableRow,
  Paper as MuiPaper,
  TablePagination as MuiTablePagination,
  Box as MuiBox,
  Typography as MuiTypography,
  Grid as MuiGrid,
  TextField as MuiTextField,
  Alert as MuiAlert,
  CircularProgress as MuiCircularProgress,
  Collapse
} from '@mui/material';

import apiClient from '../../api/client';
import PageHeader from '../../components/PageHeader';

const AuditTrail = () => {
  const [records, setRecords] = useState([]);
  const [total, setTotal] = useState(0);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [expandedRows, setExpandedRows] = useState({});

  useEffect(() => {
    const today = new Date();
    const pastMonth = new Date();
    pastMonth.setMonth(today.getMonth() - 1);
    
    setStartDate(pastMonth.toISOString().split('T')[0]);
    setEndDate(today.toISOString().split('T')[0]);
  }, []);

  const loadReport = async () => {
    if (!startDate || !endDate) return;
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get('/reports/audit-trail', {
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
      setError('Failed to fetch MCA 2021 Audit Trail.');
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
      const response = await apiClient.get('/reports/audit-trail', {
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
      link.setAttribute('download', `Audit_Trail_Report_${startDate}_to_${endDate}.xlsx`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      setError('Failed to export Audit Trail to Excel.');
    }
  };

  const toggleRow = (id) => {
    setExpandedRows(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const formatTimestamp = (ts) => {
    return new Date(ts).toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      hour12: true
    });
  };

  const getActionColor = (act) => {
    if (act === 'create') return 'success.main';
    if (act === 'modify') return 'warning.main';
    return 'error.main';
  };

  return (
    <MuiBox>
      <PageHeader
        title="MCA 2021 Audit Trail Log"
        breadcrumbs={[
          { label: 'Dashboard', to: '/' },
          { label: 'Accounts', to: '/accounts/chart-of-accounts' },
          { label: 'Audit Trail' },
        ]}
        actions={
          <MuiButton
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
          </MuiButton>
        }
      />

      {error && (
        <MuiAlert severity="error" onClose={() => setError(null)} sx={{ mb: 3, borderRadius: '8px' }}>
          {error}
        </MuiAlert>
      )}

      {/* Date Filters */}
      <MuiPaper sx={{ p: 3, mb: 3, borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
        <MuiGrid container spacing={3} alignItems="center">
          <MuiGrid item xs={12} sm={4}>
            <MuiTextField
              label="Start Date"
              type="date"
              fullWidth
              InputLabelProps={{ shrink: true }}
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </MuiGrid>
          <MuiGrid item xs={12} sm={4}>
            <MuiTextField
              label="End Date"
              type="date"
              fullWidth
              InputLabelProps={{ shrink: true }}
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </MuiGrid>
          <MuiGrid item xs={12} sm={4}>
            <MuiButton
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
              {loading ? <MuiCircularProgress size={24} color="inherit" /> : 'Fetch Logs'}
            </MuiButton>
          </MuiGrid>
        </MuiGrid>
      </MuiPaper>

      {/* Tabular Preview */}
      <MuiPaper sx={{ width: '100%', overflow: 'hidden', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
        <MuiTableContainer sx={{ maxHeight: 600 }}>
          <MuiTable stickyHeader size="small">
            <MuiTableHead>
              <MuiTableRow>
                <MuiTableCell sx={{ backgroundColor: '#1b4332', color: '#ffffff', fontWeight: 600, width: 50 }} />
                <MuiTableCell sx={{ backgroundColor: '#1b4332', color: '#ffffff', fontWeight: 600 }}>Timestamp (IST)</MuiTableCell>
                <MuiTableCell sx={{ backgroundColor: '#1b4332', color: '#ffffff', fontWeight: 600 }}>User</MuiTableCell>
                <MuiTableCell sx={{ backgroundColor: '#1b4332', color: '#ffffff', fontWeight: 600 }}>Client IP</MuiTableCell>
                <MuiTableCell sx={{ backgroundColor: '#1b4332', color: '#ffffff', fontWeight: 600 }}>Action</MuiTableCell>
                <MuiTableCell sx={{ backgroundColor: '#1b4332', color: '#ffffff', fontWeight: 600 }}>Book of Account</MuiTableCell>
                <MuiTableCell sx={{ backgroundColor: '#1b4332', color: '#ffffff', fontWeight: 600 }}>Record ID</MuiTableCell>
              </MuiTableRow>
            </MuiTableHead>
            <MuiTableBody>
              {loading ? (
                <MuiTableRow>
                  <MuiTableCell colSpan={7} align="center" sx={{ py: 6 }}>
                    <MuiCircularProgress size={36} sx={{ color: '#1b4332' }} />
                  </MuiTableCell>
                </MuiTableRow>
              ) : records.length === 0 ? (
                <MuiTableRow>
                  <MuiTableCell colSpan={7} align="center" sx={{ py: 6 }}>
                    <MuiTypography color="text.secondary">No modification logs found for this period.</MuiTypography>
                  </MuiTableCell>
                </MuiTableRow>
              ) : (
                records.map((row) => {
                  const isExpanded = !!expandedRows[row.id];
                  return (
                    <React.Fragment key={row.id}>
                      <MuiTableRow hover onClick={() => toggleRow(row.id)} sx={{ cursor: 'pointer' }}>
                        <MuiTableCell>
                          <IconButton size="small">
                            {isExpanded ? <ExpandMoreIcon /> : <ChevronRightIcon />}
                          </IconButton>
                        </MuiTableCell>
                        <MuiTableCell sx={{ fontWeight: 500 }}>{formatTimestamp(row.timestamp)}</MuiTableCell>
                        <MuiTableCell>{row.user.email} ({row.user.full_name})</MuiTableCell>
                        <MuiTableCell>{row.ip_address || 'N/A'}</MuiTableCell>
                        <MuiTableCell sx={{ fontWeight: 700, color: getActionColor(row.action), textTransform: 'uppercase' }}>
                          {row.action}
                        </MuiTableCell>
                        <MuiTableCell sx={{ fontWeight: 600 }}>{row.table_name}</MuiTableCell>
                        <MuiTableCell sx={{ fontSize: '0.8rem', color: 'text.secondary' }}>{row.record_id}</MuiTableCell>
                      </MuiTableRow>
                      <MuiTableRow>
                        <MuiTableCell colSpan={7} style={{ paddingBottom: 0, paddingTop: 0 }}>
                          <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                            <MuiBox sx={{ py: 2, px: 4, backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                              <MuiTypography variant="subtitle2" sx={{ mb: 1, fontWeight: 700 }}>Record Modification Details</MuiTypography>
                              <MuiGrid container spacing={3}>
                                <MuiGrid item xs={12} sm={6}>
                                  <MuiTypography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>OLD VALUES</MuiTypography>
                                  <pre style={{
                                    margin: '8px 0 0 0',
                                    padding: '12px',
                                    backgroundColor: '#fee2e2',
                                    borderRadius: '6px',
                                    overflowX: 'auto',
                                    fontSize: '0.8rem',
                                    fontFamily: 'monospace'
                                  }}>
                                    {row.old_values ? JSON.stringify(row.old_values, null, 2) : 'N/A (Record Created)'}
                                  </pre>
                                </MuiGrid>
                                <MuiGrid item xs={12} sm={6}>
                                  <MuiTypography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>NEW VALUES</MuiTypography>
                                  <pre style={{
                                    margin: '8px 0 0 0',
                                    padding: '12px',
                                    backgroundColor: '#dcfce7',
                                    borderRadius: '6px',
                                    overflowX: 'auto',
                                    fontSize: '0.8rem',
                                    fontFamily: 'monospace'
                                  }}>
                                    {row.new_values ? JSON.stringify(row.new_values, null, 2) : 'N/A (Record Deleted)'}
                                  </pre>
                                </MuiGrid>
                              </MuiGrid>
                            </MuiBox>
                          </Collapse>
                        </MuiTableCell>
                      </MuiTableRow>
                    </React.Fragment>
                  );
                })
              )}
            </MuiTableBody>
          </MuiTable>
        </MuiTableContainer>
        <MuiTablePagination
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
      </MuiPaper>
    </MuiBox>
  );
};

export default AuditTrail;
