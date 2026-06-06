import React, { useState, useEffect } from 'react';
import { Button, Box, Alert, MenuItem, TextField, Typography, Autocomplete } from '@mui/material';
import { Add as AddIcon } from '@mui/icons-material';

import apiClient from '../../api/client';
import CommonTable from '../../components/CommonTable';
import CommonModal from '../../components/CommonModal';

const Payments = () => {
  const [outstandings, setOutstandings] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  
  // Outstanding invoices mapping for checked selection and amounts
  const [checkedInvoices, setCheckedInvoices] = useState({}); // { [invoiceId]: { checked: bool, amount: number, maxAmount: number, invoiceNumber: string } }
  
  // Payment metadata states
  const [paymentMode, setPaymentMode] = useState('UPI');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [advanceAmount, setAdvanceAmount] = useState(0);
  const [notes, setNotes] = useState('Payment collection entry.');

  const [openModal, setOpenModal] = useState(false);
  const [error, setError] = useState(null);

  const loadData = async () => {
    try {
      const oRes = await apiClient.get('/payments/outstanding');
      setOutstandings(oRes.data);
      
      const custRes = await apiClient.get('/customers/');
      setCustomers(custRes.data.filter(c => c.is_active !== false));
    } catch (err) {
      setError('Failed to load outstanding invoice data.');
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Update checkable outstanding invoices list whenever selected customer changes
  useEffect(() => {
    if (selectedCustomer) {
      const customerInvoices = outstandings.filter(inv => inv.customer_id === selectedCustomer.id);
      const invoiceState = {};
      customerInvoices.forEach(inv => {
        const outstanding = inv.outstanding_amount !== undefined && inv.outstanding_amount !== null ? inv.outstanding_amount : inv.total_amount;
        invoiceState[inv.id] = {
          checked: false,
          amount: outstanding,
          maxAmount: outstanding,
          totalAmount: inv.total_amount,
          invoiceNumber: inv.invoice_number
        };
      });
      setCheckedInvoices(invoiceState);
    } else {
      setCheckedInvoices({});
    }
  }, [selectedCustomer, outstandings]);

  const handleOpenAdd = () => {
    setSelectedCustomer(null);
    setCheckedInvoices({});
    setPaymentMode('UPI');
    setReferenceNumber('');
    setAdvanceAmount(0);
    setNotes('Payment collection entry.');
    setOpenModal(true);
  };

  const handleSubmitPayments = async (e) => {
    e.preventDefault();
    setError(null);

    const selectedInvs = Object.keys(checkedInvoices).filter(
      (id) => checkedInvoices[id].checked && checkedInvoices[id].amount > 0
    );

    if (selectedInvs.length === 0 && parseFloat(advanceAmount) <= 0) {
      setError('Please select at least one invoice or specify an advance payment amount.');
      return;
    }

    try {
      // 1. Process all selected invoices (post separate collections)
      for (const invId of selectedInvs) {
        const inv = checkedInvoices[invId];
        const payload = {
          customer_id: selectedCustomer.id,
          invoice_id: invId,
          payment_mode: paymentMode,
          reference_number: referenceNumber,
          amount_paid: parseFloat(inv.amount),
          notes: notes
        };
        await apiClient.post('/payments/', payload);
      }

      // 2. Process advance payment if specified
      if (parseFloat(advanceAmount) > 0) {
        const payload = {
          customer_id: selectedCustomer.id,
          invoice_id: null,
          payment_mode: paymentMode,
          reference_number: referenceNumber,
          amount_paid: parseFloat(advanceAmount),
          notes: `${notes} (Advance Payment)`
        };
        await apiClient.post('/payments/', payload);
      }

      setOpenModal(false);
      loadData();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to record customer payments.');
    }
  };

  const totalAmountCollected =
    Object.values(checkedInvoices)
      .filter((inv) => inv.checked)
      .reduce((sum, inv) => sum + (parseFloat(inv.amount) || 0), 0) +
    (parseFloat(advanceAmount) || 0);

  const columns = [
    { id: 'invoice_number', label: 'Invoice Reference' },
    {
      id: 'customer_name',
      label: 'Customer Name',
      render: (row) => row.customer_name || 'Corporate Client',
    },
    { id: 'total_amount', label: 'Invoice Value (₹)', render: (row) => `₹${row.total_amount.toFixed(2)}` },
    {
      id: 'outstanding_amount',
      label: 'Outstanding (₹)',
      render: (row) => `₹${(row.outstanding_amount !== undefined && row.outstanding_amount !== null ? row.outstanding_amount : row.total_amount).toFixed(2)}`
    },
    {
      id: 'status',
      label: 'Status',
      render: (row) => (
        <Typography
          variant="caption"
          sx={{
            px: 1,
            py: 0.5,
            borderRadius: '4px',
            fontWeight: 600,
            backgroundColor: 'rgba(217, 4, 41, 0.1)',
            color: '#d90429',
          }}
        >
          {row.status}
        </Typography>
      ),
    },
  ];

  const payModes = [
    { value: 'UPI', label: 'UPI (GPay/PhonePe)' },
    { value: 'cash', label: 'Cash Payment' },
    { value: 'cheque', label: 'Cheque Clearance' },
    { value: 'bank', label: 'Bank IMPS/NEFT Transfer' },
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
        rows={outstandings}
        searchKey="invoice_number"
        tableActions={
          <Button variant="contained" startIcon={<AddIcon />} onClick={handleOpenAdd}>
            Collect Payment
          </Button>
        }
      />

      <CommonModal open={openModal} onClose={() => setOpenModal(false)} title="Collect Customer Payment" maxWidth="sm">
        <form onSubmit={handleSubmitPayments}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
            
            <Autocomplete
              options={customers}
              getOptionLabel={(option) => `${option.name} (${option.code || 'N/A'})`}
              value={selectedCustomer}
              onChange={(event, newValue) => setSelectedCustomer(newValue)}
              renderInput={(params) => (
                <TextField {...params} label="Select Customer" variant="outlined" size="small" required fullWidth />
              )}
            />

            {/* Invoices Checklist (Renders only if customer is selected) */}
            {selectedCustomer && (
              <Box sx={{ mt: 1 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1, color: '#475569' }}>
                  Select Outstanding Invoices to Apply Payment:
                </Typography>
                
                {Object.keys(checkedInvoices).length === 0 ? (
                  <Alert severity="info" sx={{ py: 0.5 }}>
                    No outstanding invoices. Payment will be processed as Advance.
                  </Alert>
                ) : (
                  <Box sx={{
                    maxHeight: 180,
                    overflowY: 'auto',
                    p: 1.5,
                    border: '1px solid #cbd5e1',
                    borderRadius: '8px',
                    backgroundColor: '#f8fafc'
                  }}>
                    {Object.keys(checkedInvoices).map((invId) => {
                      const inv = checkedInvoices[invId];
                      return (
                        <Box key={invId} sx={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          mb: 1.5,
                          '&:last-child': { mb: 0 }
                        }}>
                          <Box sx={{ display: 'flex', alignItems: 'center' }}>
                            <input
                              type="checkbox"
                              checked={inv.checked}
                              onChange={(e) => {
                                setCheckedInvoices(prev => ({
                                  ...prev,
                                  [invId]: { ...prev[invId], checked: e.target.checked }
                                }));
                              }}
                              style={{ marginRight: 10, width: 18, height: 18, cursor: 'pointer' }}
                            />
                            <Typography variant="body2" sx={{ fontWeight: 500 }}>
                              {inv.invoiceNumber} (Outstanding: ₹{inv.maxAmount.toFixed(2)} / Total: ₹{inv.totalAmount.toFixed(2)})
                            </Typography>
                          </Box>
                          
                          {inv.checked && (
                            <TextField
                              size="small"
                              type="number"
                              label="Amount (₹)"
                              value={inv.amount}
                              onChange={(e) => {
                                const val = parseFloat(e.target.value) || 0;
                                setCheckedInvoices(prev => ({
                                  ...prev,
                                  [invId]: { ...prev[invId], amount: val }
                                }));
                              }}
                              sx={{ width: 120, backgroundColor: '#ffffff' }}
                              inputProps={{ min: 0, max: inv.maxAmount, step: 'any' }}
                            />
                          )}
                        </Box>
                      );
                    })}
                  </Box>
                )}
              </Box>
            )}

            {/* Advance Payment Field */}
            {selectedCustomer && (
              <TextField
                label="Advance Payment Amount (₹)"
                type="number"
                size="small"
                value={advanceAmount === 0 ? '' : advanceAmount}
                onChange={(e) => setAdvanceAmount(parseFloat(e.target.value) || 0)}
                fullWidth
                inputProps={{ min: 0, step: 'any' }}
              />
            )}

            <TextField
              select
              label="Payment Mode"
              size="small"
              value={paymentMode}
              onChange={(e) => setPaymentMode(e.target.value)}
              fullWidth
              required
            >
              {payModes.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </TextField>

            <TextField
              label="Transaction ID / Cheque Ref #"
              size="small"
              value={referenceNumber}
              onChange={(e) => setReferenceNumber(e.target.value)}
              fullWidth
            />

            {/* Computed Auto-Summed Amount */}
            <TextField
              label="Total Amount Collected (₹)"
              size="small"
              type="number"
              value={totalAmountCollected}
              disabled
              fullWidth
              InputProps={{ readOnly: true }}
            />

            <TextField
              label="Reference Notes"
              size="small"
              multiline
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              fullWidth
            />
          </Box>
          
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, mt: 3 }}>
            <Button onClick={() => setOpenModal(false)} variant="outlined">
              Cancel
            </Button>
            <Button type="submit" variant="contained">
              Record Collection
            </Button>
          </Box>
        </form>
      </CommonModal>
    </Box>
  );
};

export default Payments;
