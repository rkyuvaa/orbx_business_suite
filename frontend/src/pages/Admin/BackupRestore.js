import React, { useState, useEffect } from 'react';
import {
  Box, Button, Alert, Typography, Grid, Paper,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  CircularProgress, IconButton, Tooltip, Dialog, DialogTitle,
  DialogContent, DialogContentText, DialogActions, LinearProgress
} from '@mui/material';
import {
  CloudUpload as UploadIcon,
  CloudDownload as DownloadIcon,
  Delete as DeleteIcon,
  Backup as BackupIcon,
  Refresh as RefreshIcon,
  Warning as WarningIcon
} from '@mui/icons-material';

import apiClient from '../../api/client';
import PageHeader from '../../components/PageHeader';

const BackupRestore = () => {
  const [backups, setBackups] = useState([]);
  const [loading, setLoading] = useState(false);
  const [restoreLoading, setRestoreLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);

  // Dialog configurations
  const [openRestoreConfirm, setOpenRestoreConfirm] = useState(false);

  const loadBackups = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get('/admin/backups');
      setBackups(res.data);
    } catch (err) {
      setError('Failed to fetch existing system backups.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBackups();
  }, []);

  const handleGenerateBackup = async () => {
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await apiClient.post('/admin/backups/generate');
      setSuccess(res.data.message || 'Backup snapshot created successfully.');
      loadBackups();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to generate database backup.');
      setLoading(false);
    }
  };

  const handleDownload = (filename) => {
    const url = `${apiClient.defaults.baseURL}/admin/backups/${filename}/download`;
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      setSelectedFile(e.target.files[0]);
      setSuccess(null);
      setError(null);
    }
  };

  const handleRestoreSubmit = () => {
    if (!selectedFile) return;
    setOpenRestoreConfirm(true);
  };

  const executeRestore = async () => {
    setOpenRestoreConfirm(false);
    setRestoreLoading(true);
    setError(null);
    setSuccess(null);

    const formData = new FormData();
    formData.append('file', selectedFile);

    try {
      const res = await apiClient.post('/admin/backups/restore', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      setSuccess(res.data.message || 'Recovery job started successfully in the background.');
      setSelectedFile(null);
      
      // Reset input element value
      const fileInput = document.getElementById('restore-file-input');
      if (fileInput) fileInput.value = '';
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to execute database restoration.');
    } finally {
      setRestoreLoading(false);
    }
  };

  const formatBytes = (bytes, decimals = 2) => {
    if (!bytes) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  };

  return (
    <Box>
      <PageHeader
        title="Backup & Restore Config"
        breadcrumbs={[
          { label: 'Dashboard', to: '/' },
          { label: 'Admin', to: '/admin/company' },
          { label: 'Backup & Restore' },
        ]}
        actions={
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={loadBackups}
            disabled={loading || restoreLoading}
            sx={{
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
            Refresh List
          </Button>
        }
      />

      {success && (
        <Alert severity="success" onClose={() => setSuccess(null)} sx={{ mb: 3, borderRadius: '8px' }}>
          {success}
        </Alert>
      )}

      {error && (
        <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 3, borderRadius: '8px' }}>
          {error}
        </Alert>
      )}

      {restoreLoading && (
        <Paper sx={{ p: 3, mb: 3, borderRadius: '12px', border: '1px solid #ffb703', backgroundColor: 'rgba(255, 183, 3, 0.04)' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1.5 }}>
            <CircularProgress size={24} sx={{ color: '#ffb703' }} />
            <Typography sx={{ fontWeight: 600, color: '#d97706' }}>
              System recovery is running in the background. Please do not close this window...
            </Typography>
          </Box>
          <LinearProgress color="warning" />
        </Paper>
      )}

      <Grid container spacing={3}>
        {/* Left Side: Actions */}
        <Grid item xs={12} md={5}>
          <Grid container spacing={3}>
            {/* Create Backup */}
            <Grid item xs={12}>
              <Paper sx={{ p: 3, borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
                  <BackupIcon sx={{ color: '#1b4332', fontSize: '2rem' }} />
                  <Typography variant="h6" sx={{ fontWeight: 700, color: '#1b4332' }}>
                    Generate DB Snapshot
                  </Typography>
                </Box>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                  Create a secure, downloadable backup bundle containing the active PostgreSQL database schema, configurations, and records.
                </Typography>
                <Button
                  variant="contained"
                  fullWidth
                  onClick={handleGenerateBackup}
                  disabled={loading || restoreLoading}
                  sx={{
                    backgroundColor: '#1b4332',
                    '&:hover': { backgroundColor: '#133024' },
                    borderRadius: '8px',
                    py: 1.2,
                    textTransform: 'none',
                    fontWeight: 600
                  }}
                >
                  {loading ? <CircularProgress size={20} color="inherit" /> : 'Generate Backup Now'}
                </Button>
              </Paper>
            </Grid>

            {/* Restore Backup */}
            <Grid item xs={12}>
              <Paper sx={{ p: 3, borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
                  <UploadIcon sx={{ color: '#ffb703', fontSize: '2rem' }} />
                  <Typography variant="h6" sx={{ fontWeight: 700, color: '#1b4332' }}>
                    Upload & Restore Backup
                  </Typography>
                </Box>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5 }}>
                  Select a previously generated backup bundle (.zip) to restore system tables and database values.
                </Typography>

                <Box sx={{ mb: 3 }}>
                  <input
                    accept=".zip"
                    style={{ display: 'none' }}
                    id="restore-file-input"
                    type="file"
                    onChange={handleFileChange}
                    disabled={loading || restoreLoading}
                  />
                  <label htmlFor="restore-file-input">
                    <Button
                      variant="outlined"
                      component="span"
                      fullWidth
                      startIcon={<UploadIcon />}
                      sx={{
                        borderStyle: 'dashed',
                        borderWidth: 2,
                        py: 1.5,
                        borderColor: '#94a3b8',
                        color: '#475569',
                        '&:hover': {
                          borderColor: '#1b4332',
                          backgroundColor: 'rgba(27, 67, 50, 0.02)'
                        }
                      }}
                    >
                      {selectedFile ? selectedFile.name : 'Select Backup ZIP'}
                    </Button>
                  </label>
                </Box>

                <Button
                  variant="contained"
                  fullWidth
                  color="warning"
                  onClick={handleRestoreSubmit}
                  disabled={!selectedFile || loading || restoreLoading}
                  sx={{
                    borderRadius: '8px',
                    py: 1.2,
                    textTransform: 'none',
                    fontWeight: 600
                  }}
                >
                  Initiate System Restore
                </Button>
              </Paper>
            </Grid>
          </Grid>
        </Grid>

        {/* Right Side: Backups History List */}
        <Grid item xs={12} md={7}>
          <Paper sx={{ p: 3, borderRadius: '12px', minHeight: 450, boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
            <Typography variant="h6" sx={{ fontWeight: 700, color: '#1b4332', mb: 2.5 }}>
              Available Snapshot History
            </Typography>

            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 600, backgroundColor: '#f8fafc' }}>Filename</TableCell>
                    <TableCell sx={{ fontWeight: 600, backgroundColor: '#f8fafc' }}>Size</TableCell>
                    <TableCell sx={{ fontWeight: 600, backgroundColor: '#f8fafc' }}>Created Date</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 600, backgroundColor: '#f8fafc' }}>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {backups.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} align="center" sx={{ py: 6, color: 'text.secondary' }}>
                        {loading ? <CircularProgress size={24} /> : 'No backup snapshots found.'}
                      </TableCell>
                    </TableRow>
                  ) : (
                    backups.map((row, idx) => (
                      <TableRow hover key={row.filename || idx}>
                        <TableCell sx={{ fontWeight: 500, wordBreak: 'break-all' }}>{row.filename}</TableCell>
                        <TableCell>{formatBytes(row.size)}</TableCell>
                        <TableCell>{new Date(row.created_at).toLocaleString()}</TableCell>
                        <TableCell align="right">
                          <Tooltip title="Download ZIP">
                            <IconButton
                              size="small"
                              color="primary"
                              onClick={() => handleDownload(row.filename)}
                            >
                              <DownloadIcon />
                            </IconButton>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </Grid>
      </Grid>

      {/* Confirmation Dialog for Recovery */}
      <Dialog
        open={openRestoreConfirm}
        onClose={() => setOpenRestoreConfirm(false)}
        aria-labelledby="restore-confirm-title"
        aria-describedby="restore-confirm-description"
        PaperProps={{
          sx: { borderRadius: '12px', p: 1 }
        }}
      >
        <DialogTitle id="restore-confirm-title" sx={{ display: 'flex', alignItems: 'center', gap: 1, color: '#d00000', fontWeight: 700 }}>
          <WarningIcon /> Warning: Restore Action
        </DialogTitle>
        <DialogContent>
          <DialogContentText id="restore-confirm-description" sx={{ color: 'text.primary', mb: 2 }}>
            You are about to restore the database from the snapshot: <strong>{selectedFile?.name}</strong>.
          </DialogContentText>
          <DialogContentText sx={{ color: 'text.secondary', fontSize: '0.875rem' }}>
            This will drop and recreate your current schema and overwrite all existing transaction data, masters, invoices, and users. This action cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button
            onClick={() => setOpenRestoreConfirm(false)}
            sx={{ textTransform: 'none', fontWeight: 600, color: 'text.secondary' }}
          >
            Cancel
          </Button>
          <Button
            onClick={executeRestore}
            variant="contained"
            color="error"
            autoFocus
            sx={{
              borderRadius: '8px',
              textTransform: 'none',
              fontWeight: 600,
              backgroundColor: '#d00000',
              '&:hover': { backgroundColor: '#a00000' }
            }}
          >
            Confirm Recovery
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default BackupRestore;
