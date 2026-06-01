import React, { useState, useEffect, useRef } from 'react';
import { useReactToPrint } from 'react-to-print';
import { Button, Box, Alert, Paper, Typography, Grid, Divider, Table, TableHead, TableRow, TableCell, TableBody } from '@mui/material';
import { Print as PrintIcon } from '@mui/icons-material';

import apiClient from '../../api/client';
import PageHeader from '../../components/PageHeader';
import CommonTable from '../../components/CommonTable';
import CommonModal from '../../components/CommonModal';

const Receipts = () => {
  const [invoices, setInvoices] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [company, setCompany] = useState(null);
  
  const [openPrintModal, setOpenPrintModal] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState(null);

  const [error, setError] = useState(null);
  const printRef = useRef();

  const loadData = async () => {
    try {
      // List invoices that have some payment history
      const invRes = await apiClient.get('/sales/invoices');
      const custRes = await apiClient.get('/customers/');
      const compRes = await apiClient.get('/admin/company');
      
      const paidInvoices = invRes.data.filter((i) => i.status === 'Paid' || i.status === 'PartiallyPaid');
      setInvoices(paidInvoices);
      setCustomers(custRes.data);
      setCompany(compRes.data);
    } catch (err) {
      setError('Failed to load payment receipt records.');
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleOpenPrint = (inv) => {
    setSelectedInvoice(inv);
    setOpenPrintModal(true);
  };

  const handlePrint = useReactToPrint({
    content: () => printRef.current,
  });

  // Simple number-to-words generator for Dollars
  const numberToWords = (num) => {
    if (num === 0) return 'Zero Dollars Only';
    const units = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
    const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
    
    const convert = (n) => {
      if (n < 20) return units[n];
      if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 !== 0 ? ' ' + units[n % 10] : '');
      if (n < 1000) return units[Math.floor(n / 100)] + ' Hundred' + (n % 100 !== 0 ? ' and ' + convert(n % 100) : '');
      return '';
    };

    const dollars = Math.floor(num);
    const cents = Math.round((num - dollars) * 100);
    
    let word = convert(dollars) + ' Dollars';
    if (cents > 0) {
      word += ' and ' + convert(cents) + ' Cents';
    }
    return word + ' Only';
  };

  const columns = [
    { id: 'invoice_number', label: 'Linked Invoice #' },
    {
      id: 'customer',
      label: 'Customer Name',
      render: (row) => {
        // Find matching customer
        return 'Corporate Client';
      }
    },
    { id: 'date', label: 'Payment Date', render: (row) => new Date(row.date).toLocaleDateString() },
    { id: 'total_amount', label: 'Amount Cleared', render: (row) => `$${row.total_amount.toFixed(2)}` },
  ];

  return (
    <Box>
      <PageHeader
        title="Payment Receipts"
        breadcrumbs={[
          { label: 'Dashboard', to: '/' },
          { label: 'Payment Receipts' },
        ]}
      />

      {error && (
        <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      <CommonTable
        columns={columns}
        rows={invoices}
        actions={[
          {
            icon: <PrintIcon />,
            label: 'Print Payment Receipt',
            onClick: handleOpenPrint,
            color: 'primary'
          }
        ]}
        searchKey="invoice_number"
      />

      <CommonModal
        open={openPrintModal}
        onClose={() => setOpenPrintModal(false)}
        title="Print Payment Receipt"
        maxWidth="sm"
        actions={
          <Button variant="contained" startIcon={<PrintIcon />} onClick={handlePrint}>
            Print Receipt
          </Button>
        }
      >
        <Box
          ref={printRef}
          sx={{
            p: 4,
            backgroundColor: '#ffffff',
            color: '#000000',
            border: '1px dashed #cbd5e1',
            borderRadius: '8px',
            '@media print': {
              p: 0,
              border: 'none'
            }
          }}
        >
          {/* Header */}
          <Box sx={{ textAlign: 'center', mb: 3 }}>
            <Typography variant="h5" sx={{ fontWeight: 800, color: 'primary.main', mb: 0.5 }}>
              {company?.name || 'ORBX CORPORATION'}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {company?.address || '123 Corporate Blvd, Silicon Valley'}
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
              GSTIN: {company?.gstin} | Phone: {company?.phone}
            </Typography>
          </Box>

          <Divider sx={{ my: 2 }} />

          <Typography variant="h6" align="center" sx={{ fontWeight: 700, letterSpacing: '1px', mb: 3 }}>
            PAYMENT RECEIPT
          </Typography>

          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid item xs={6}>
              <Typography variant="body2" color="text.secondary">Receipt Number:</Typography>
              <Typography variant="body1" sx={{ fontWeight: 700 }}>
                RCPT-{selectedInvoice?.id.hex[:6].toUpperCase()}
              </Typography>
            </Grid>
            <Grid item xs={6} sx={{ textAlign: 'right' }}>
              <Typography variant="body2" color="text.secondary">Date Received:</Typography>
              <Typography variant="body1" sx={{ fontWeight: 700 }}>
                {selectedInvoice ? new Date(selectedInvoice.date).toLocaleDateString() : ''}
              </Typography>
            </Grid>
          </Grid>

          <Box sx={{ backgroundColor: '#f8fafc', p: 3, borderRadius: '8px', mb: 3 }}>
            <Box sx={{ display: 'grid', gridTemplateColumns: '150px 1fr', gap: 1.5 }}>
              <Typography variant="body2" color="text.secondary">Received From:</Typography>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>Corporate Client</Typography>

              <Typography variant="body2" color="text.secondary">Payment For:</Typography>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>Invoice {selectedInvoice?.invoice_number}</Typography>

              <Typography variant="body2" color="text.secondary">Amount Paid:</Typography>
              <Typography variant="body1" color="primary.main" sx={{ fontWeight: 700 }}>
                ${selectedInvoice?.total_amount?.toFixed(2)}
              </Typography>

              <Typography variant="body2" color="text.secondary">Amount in Words:</Typography>
              <Typography variant="body2" sx={{ fontWeight: 600, fontStyle: 'italic' }}>
                {selectedInvoice ? numberToWords(selectedInvoice.total_amount) : ''}
              </Typography>

              <Typography variant="body2" color="text.secondary">Payment Method:</Typography>
              <Typography variant="body2" sx={{ fontWeight: 600, textTransform: 'uppercase' }}>UPI / Digital Bank</Typography>
            </Box>
          </Box>

          <Grid container justifyContent="space-between" sx={{ mt: 5 }}>
            <Grid item>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 4 }}>
                Prepared By:
              </Typography>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>Accounts Officer</Typography>
            </Grid>
            <Grid item sx={{ textAlign: 'right' }}>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 4 }}>
                Authorized Seal:
              </Typography>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>Cashier Signature</Typography>
            </Grid>
          </Grid>
        </Box>
      </CommonModal>
    </Box>
  );
};

export default Receipts;
