import React, { useState, useEffect, useRef } from 'react';
import { useReactToPrint } from 'react-to-print';
import { Button, Box, Alert, Paper, Typography, Grid, Divider } from '@mui/material';
import { Print as PrintIcon, Block as CancelIcon, Delete as DeleteIcon } from '@mui/icons-material';
import { useSelector } from 'react-redux';

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

  const { user } = useSelector((state) => state.auth);
  const isSuperAdmin = user?.role_name === 'Super Admin';

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

  const handleDeletePayment = async (payment) => {
    if (window.confirm(`WARNING: Are you sure you want to PERMANENTLY delete Payment Receipt ${payment.receipt_number || 'N/A'}? This action cannot be undone.`)) {
      try {
        await apiClient.delete(`/payments/${payment.id}`);
        loadData();
      } catch (err) {
        setError(err.response?.data?.detail || 'Failed to delete payment receipt.');
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
    if (num === undefined || num === null || isNaN(num)) return 'Zero Rupees Only';
    let n = parseFloat(num);
    if (n === 0) return 'Zero Rupees Only';

    const units = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
    const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

    const convertLessThanOneThousand = (val) => {
      if (val < 20) return units[val];
      if (val < 100) return tens[Math.floor(val / 10)] + (val % 10 !== 0 ? ' ' + units[val % 10] : '');
      return units[Math.floor(val / 100)] + ' Hundred' + (val % 100 !== 0 ? ' and ' + convertLessThanOneThousand(val % 100) : '');
    };

    const convert = (val) => {
      if (val === 0) return '';
      let parts = [];
      
      // Crores
      if (val >= 10000000) {
        const crores = Math.floor(val / 10000000);
        parts.push(convertLessThanOneThousand(crores) + ' Crore');
        val %= 10000000;
      }
      
      // Lakhs
      if (val >= 100000) {
        const lakhs = Math.floor(val / 100000);
        parts.push(convertLessThanOneThousand(lakhs) + ' Lakh');
        val %= 100000;
      }
      
      // Thousands
      if (val >= 1000) {
        const thousands = Math.floor(val / 1000);
        parts.push(convertLessThanOneThousand(thousands) + ' Thousand');
        val %= 1000;
      }
      
      // Remainder under 1000
      if (val > 0) {
        parts.push(convertLessThanOneThousand(val));
      }
      
      return parts.join(' ').trim();
    };

    const rupees = Math.floor(n);
    const paise = Math.round((n - rupees) * 100);
    
    let word = '';
    if (rupees > 0) {
      word += convert(rupees) + ' Rupees';
    } else {
      word += 'Zero Rupees';
    }
    
    if (paise > 0) {
      word += ' and ' + convertLessThanOneThousand(paise) + ' Paise';
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
          },
          ...(isSuperAdmin ? [{
            icon: <DeleteIcon />,
            label: 'Delete Payment Receipt',
            onClick: handleDeletePayment,
            color: 'error'
          }] : [])
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

