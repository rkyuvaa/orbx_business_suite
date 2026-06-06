import React, { useState, useEffect, useRef } from 'react';
import { useReactToPrint } from 'react-to-print';
import { Button, Box, Alert, Paper, Typography, Grid, Divider } from '@mui/material';
import { Print as PrintIcon, Block as CancelIcon } from '@mui/icons-material';

import apiClient from '../../api/client';
import CommonTable from '../../components/CommonTable';
import CommonModal from '../../components/CommonModal';

const Receipts = () => {
  const [payments, setPayments] = useState([]);
  const [company, setCompany] = useState(null);
  
  const [openPrintModal, setOpenPrintModal] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState(null);

  const [error, setError] = useState(null);
  const printRef = useRef();

  const loadData = async () => {
    try {
      const payRes = await apiClient.get('/payments/');
      const compRes = await apiClient.get('/admin/company');
      
      setPayments(payRes.data);
      setCompany(compRes.data);
    } catch (err) {
      setError('Failed to load payment receipt records.');
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCancelPayment = async (payment) => {
    if (window.confirm(`Are you sure you want to cancel and reverse Payment Receipt ${payment.receipt_number || 'N/A'} for ₹${payment.amount_paid.toFixed(2)}?`)) {
      try {
        await apiClient.post(`/payments/${payment.id}/cancel`);
        loadData();
      } catch (err) {
        setError(err.response?.data?.detail || 'Failed to cancel Payment Receipt.');
      }
    }
  };

  const handleOpenPrint = (payment) => {
    setSelectedPayment(payment);
    setOpenPrintModal(true);
  };

  const handlePrint = useReactToPrint({
    content: () => printRef.current,
  });

  // Simple number-to-words generator for Rupees
  const numberToWords = (num) => {
    if (num === 0) return 'Zero Rupees Only';
    const units = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
    const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
    
    const convert = (n) => {
      if (n < 20) return units[n];
      if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 !== 0 ? ' ' + units[n % 10] : '');
      if (n < 1000) return units[Math.floor(n / 100)] + ' Hundred' + (n % 100 !== 0 ? ' and ' + convert(n % 100) : '');
      return '';
    };

    const rupees = Math.floor(num);
    const paise = Math.round((num - rupees) * 100);
    
    let word = convert(rupees) + ' Rupees';
    if (paise > 0) {
      word += ' and ' + convert(paise) + ' Paise';
    }
    return word + ' Only';
  };

  const columns = [
    { id: 'receipt_number', label: 'Receipt Number', render: (row) => row.receipt_number || 'N/A' },
    {
      id: 'invoice_number',
      label: 'Linked Invoice #',
      render: (row) => row.invoice_number || (
        <Typography variant="body2" sx={{ color: 'text.secondary', fontStyle: 'italic', fontWeight: 500 }}>
          Advance Payment
        </Typography>
      )
    },
    {
      id: 'customer_name',
      label: 'Customer Name',
      render: (row) => row.customer_name || 'Unknown'
    },
    { 
      id: 'payment_date', 
      label: 'Payment Date', 
      render: (row) => new Date(row.payment_date).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      }) 
    },
    { id: 'amount_paid', label: 'Amount Paid (₹)', render: (row) => `₹${row.amount_paid.toFixed(2)}` },
    { id: 'payment_mode', label: 'Payment Mode', render: (row) => row.payment_mode ? row.payment_mode.toUpperCase() : 'N/A' },
  ];

  return (
    <Box>
      {error && (
        <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      <CommonTable
        columns={columns}
        rows={payments}
        actions={[
          {
            icon: <PrintIcon />,
            label: 'Print Payment Receipt',
            onClick: handleOpenPrint,
            color: 'primary'
          },
          {
            icon: <CancelIcon />,
            label: 'Cancel Payment Receipt',
            onClick: handleCancelPayment,
            color: 'error'
          }
        ]}
        searchKey="receipt_number"
        searchPlaceholder="Search by receipt number..."
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
            width: '100%',
            maxWidth: '180mm',
            minHeight: '265mm',
            mx: 'auto',
            boxSizing: 'border-box',
            backgroundColor: '#ffffff',
            color: '#000000',
            fontFamily: '"Outfit", sans-serif',
            boxShadow: 'none',
            border: '1px dashed #cbd5e1',
            '@media print': {
              width: '210mm !important',
              maxWidth: '210mm !important',
              minHeight: '297mm !important',
              padding: '12mm 15mm !important',
              margin: '0 !important',
              boxShadow: 'none !important',
              boxSizing: 'border-box !important',
              border: 'none !important',
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
                {selectedPayment?.receipt_number || 'N/A'}
              </Typography>
            </Grid>
            <Grid item xs={6} sx={{ textAlign: 'right' }}>
              <Typography variant="body2" color="text.secondary">Date Received:</Typography>
              <Typography variant="body1" sx={{ fontWeight: 700 }}>
                {selectedPayment ? new Date(selectedPayment.payment_date).toLocaleDateString('en-IN') : ''}
              </Typography>
            </Grid>
          </Grid>

          <Box sx={{ backgroundColor: '#f8fafc', p: 3, borderRadius: '8px', mb: 3 }}>
            <Box sx={{ display: 'grid', gridTemplateColumns: '150px 1fr', gap: 1.5 }}>
              <Typography variant="body2" color="text.secondary">Received From:</Typography>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                {selectedPayment?.customer_name || 'Unknown'}
              </Typography>

              <Typography variant="body2" color="text.secondary">Payment For:</Typography>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                {selectedPayment?.invoice_number ? `Invoice ${selectedPayment.invoice_number}` : 'Advance Payment (No Invoice)'}
              </Typography>

              <Typography variant="body2" color="text.secondary">Amount Paid:</Typography>
              <Typography variant="body1" color="primary.main" sx={{ fontWeight: 700 }}>
                ₹{selectedPayment?.amount_paid?.toFixed(2)}
              </Typography>

              <Typography variant="body2" color="text.secondary">Amount in Words:</Typography>
              <Typography variant="body2" sx={{ fontWeight: 600, fontStyle: 'italic' }}>
                {selectedPayment ? numberToWords(selectedPayment.amount_paid) : ''}
              </Typography>

              <Typography variant="body2" color="text.secondary">Payment Method:</Typography>
              <Typography variant="body2" sx={{ fontWeight: 600, textTransform: 'uppercase' }}>
                {selectedPayment?.payment_mode || 'N/A'}
              </Typography>

              {selectedPayment?.reference_number && (
                <>
                  <Typography variant="body2" color="text.secondary">Reference #:</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {selectedPayment.reference_number}
                  </Typography>
                </>
              )}

              {selectedPayment?.notes && (
                <>
                  <Typography variant="body2" color="text.secondary">Notes:</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 500, color: 'text.secondary' }}>
                    {selectedPayment.notes}
                  </Typography>
                </>
              )}
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

