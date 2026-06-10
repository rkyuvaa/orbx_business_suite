import React, { useState, useEffect } from 'react';
import { Button, Box, Alert, MenuItem, TextField, Typography, Autocomplete } from '@mui/material';
import { Add as AddIcon, Block as CancelIcon, Delete as DeleteIcon } from '@mui/icons-material';
import { useSelector } from 'react-redux';

import apiClient from '../../api/client';
import CommonTable from '../../components/CommonTable';
import CommonModal from '../../components/CommonModal';

const VendorPayments = () => {
  const [payments, setPayments] = useState([]);
  const [outstandings, setOutstandings] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [selectedSupplier, setSelectedSupplier] = useState(null);
  
  // Outstanding bills mapping for checked selection and amounts
  const [checkedBills, setCheckedBills] = useState({}); // { [billId]: { checked: bool, amount: number, maxAmount: number, invoiceNumber: string } }
  
  // Payment metadata states
  const [paymentMode, setPaymentMode] = useState('UPI');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [advanceAmount, setAdvanceAmount] = useState(0);
  const [notes, setNotes] = useState('Vendor outward payment entry.');

  const [openModal, setOpenModal] = useState(false);
  const [error, setError] = useState(null);

  const { user } = useSelector((state) => state.auth);
  const isSuperAdmin = user?.role_name === 'Super Admin';

  const loadData = async () => {
    try {
      const pRes = await apiClient.get('/purchase/payments');
      setPayments(pRes.data);

      const oRes = await apiClient.get('/purchase/payments/outstanding');
      setOutstandings(oRes.data);
      
      const suppRes = await apiClient.get('/suppliers/');
      setSuppliers(suppRes.data.filter(s => s.is_active !== false));
    } catch (err) {
      setError('Failed to load supplier payment data.');
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Update checkable outstanding bills list when selected supplier changes
  useEffect(() => {
    if (selectedSupplier) {
      const supplierBills = outstandings.filter(bill => bill.supplier_id === selectedSupplier.id);
      const billState = {};
      supplierBills.forEach(bill => {
        const outstanding = bill.outstanding_amount !== undefined && bill.outstanding_amount !== null ? bill.outstanding_amount : bill.total_amount;
        billState[bill.id] = {
          checked: false,
          amount: outstanding,
          maxAmount: outstanding,
          totalAmount: bill.total_amount,
          invoiceNumber: bill.invoice_number
        };
      });
      setCheckedBills(billState);
    } else {
      setCheckedBills({});
    }
  }, [selectedSupplier, outstandings]);

  const handleOpenAdd = () => {
    setSelectedSupplier(null);
    setCheckedBills({});
    setPaymentMode('UPI');
    setReferenceNumber('');
    setPaymentDate(new Date().toISOString().split('T')[0]);
    setAdvanceAmount(0);
    setNotes('Vendor outward payment entry.');
    setOpenModal(true);
  };

  const handleCancelPayment = async (payment) => {
    if (window.confirm(`Are you sure you want to cancel and reverse Vendor Payment of ₹${payment.amount_paid.toFixed(2)}?`)) {
      try {
        await apiClient.post(`/purchase/payments/${payment.id}/cancel`);
        loadData();
      } catch (err) {
        setError(err.response?.data?.detail || 'Failed to cancel Vendor Payment.');
      }
    }
  };

  const handleDeletePayment = async (payment) => {
    if (window.confirm(`WARNING: Are you sure you want to PERMANENTLY delete Vendor Payment of ₹${payment.amount_paid.toFixed(2)}? This action cannot be undone.`)) {
      try {
        await apiClient.delete(`/purchase/payments/${payment.id}`);
        loadData();
      } catch (err) {
        setError(err.response?.data?.detail || 'Failed to delete Vendor Payment.');
      }
    }
  };

  const handleSubmitPayments = async (e) => {
    e.preventDefault();
    setError(null);

    const selectedInvs = Object.keys(checkedBills).filter(
      (id) => checkedBills[id].checked && checkedBills[id].amount > 0
    );

    if (selectedInvs.length === 0 && parseFloat(advanceAmount) <= 0) {
      setError('Please select at least one bill or specify an advance payment amount.');
      return;
    }

    try {
      // 1. Process all selected bills
      for (const billId of selectedInvs) {
        const bill = checkedBills[billId];
        const payload = {
          supplier_id: selectedSupplier.id,
          purchase_entry_id: billId,
          payment_date: paymentDate ? new Date(paymentDate).toISOString() : null,
          payment_mode: paymentMode,
          reference_number: referenceNumber,
          amount_paid: parseFloat(bill.amount),
          notes: notes
        };
        await apiClient.post('/purchase/payments', payload);
      }

      // 2. Process advance payment if specified
      if (parseFloat(advanceAmount) > 0) {
        const payload = {
          supplier_id: selectedSupplier.id,
          purchase_entry_id: null,
          payment_date: paymentDate ? new Date(paymentDate).toISOString() : null,
          payment_mode: paymentMode,
          reference_number: referenceNumber,
          amount_paid: parseFloat(advanceAmount),
          notes: `${notes} (Advance Payment)`
        };
        await apiClient.post('/purchase/payments', payload);
      }

      setOpenModal(false);
      loadData();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to record supplier payments.');
    }
  };

  const totalAmountPaid =
    Object.values(checkedBills)
      .filter((b) => b.checked)
      .reduce((sum, b) => sum + (parseFloat(b.amount) || 0), 0) +
    (parseFloat(advanceAmount) || 0);

  const columns = [
    {
      id: 'payment_date',
      label: 'Payment Date',
      render: (row) => new Date(row.payment_date).toLocaleDateString('en-IN')
    },
    {
      id: 'supplier_name',
      label: 'Supplier / Vendor',
      render: (row) => row.supplier_name || 'N/A'
    },
    {
      id: 'purchase_entry_number',
      label: 'Linked Supplier Bill',
      render: (row) => row.purchase_entry_number || (
        <Typography variant="body2" sx={{ color: 'text.secondary', fontStyle: 'italic', fontWeight: 500 }}>
          Advance Payment
        </Typography>
      )
    },
    {
      id: 'amount_paid',
      label: 'Amount Paid (₹)',
      render: (row) => `₹${row.amount_paid.toFixed(2)}`
    },
    {
      id: 'payment_mode',
      label: 'Payment Mode',
      render: (row) => row.payment_mode ? row.payment_mode.toUpperCase() : 'N/A'
    },
    {
      id: 'reference_number',
      label: 'Reference Number',
      render: (row) => row.reference_number || '-'
    }
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
        rows={payments}
        searchKey="supplier_name"
        searchPlaceholder="Search supplier name..."
        tableActions={
          <Button variant="contained" startIcon={<AddIcon />} onClick={handleOpenAdd}>
            Record Vendor Payment
          </Button>
        }
        actions={[
          {
            icon: <CancelIcon />,
            label: 'Cancel & Reverse Payment',
            onClick: handleCancelPayment,
            color: 'error'
          },
          ...(isSuperAdmin ? [{
            icon: <DeleteIcon />,
            label: 'Delete Vendor Payment',
            onClick: handleDeletePayment,
            color: 'error'
          }] : [])
        ]}
      />

      <CommonModal open={openModal} onClose={() => setOpenModal(false)} title="Record Supplier Payment" maxWidth="sm">
        <form onSubmit={handleSubmitPayments}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
            
            <Autocomplete
              options={suppliers}
              getOptionLabel={(option) => `${option.name} (${option.code || 'N/A'})`}
              value={selectedSupplier}
              onChange={(event, newValue) => setSelectedSupplier(newValue)}
              renderInput={(params) => (
                <TextField {...params} label="Select Supplier" variant="outlined" size="small" required fullWidth />
              )}
            />

            {/* Bills Checklist */}
            {selectedSupplier && (
              <Box sx={{ mt: 1 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1, color: '#475569' }}>
                  Select Outstanding Bills to Pay:
                </Typography>
                
                {Object.keys(checkedBills).length === 0 ? (
                  <Alert severity="info" sx={{ py: 0.5 }}>
                    No outstanding purchase bills. Payment will be processed as Advance.
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
                    {Object.keys(checkedBills).map((billId) => {
                      const bill = checkedBills[billId];
                      return (
                        <Box key={billId} sx={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          mb: 1.5,
                          '&:last-child': { mb: 0 }
                        }}>
                          <Box sx={{ display: 'flex', alignItems: 'center' }}>
                            <input
                              type="checkbox"
                              checked={bill.checked}
                              onChange={(e) => {
                                setCheckedBills(prev => ({
                                  ...prev,
                                  [billId]: { ...prev[billId], checked: e.target.checked }
                                }));
                              }}
                              style={{ marginRight: 10, width: 18, height: 18, cursor: 'pointer' }}
                            />
                            <Typography variant="body2" sx={{ fontWeight: 500 }}>
                              {bill.invoiceNumber} (Outstanding: ₹{bill.maxAmount.toFixed(2)} / Total: ₹{bill.totalAmount.toFixed(2)})
                            </Typography>
                          </Box>
                          
                          {bill.checked && (
                            <TextField
                              size="small"
                              type="number"
                              label="Amount (₹)"
                              value={bill.amount}
                              onChange={(e) => {
                                const val = parseFloat(e.target.value) || 0;
                                setCheckedBills(prev => ({
                                  ...prev,
                                  [billId]: { ...prev[billId], amount: val }
                                }));
                              }}
                              sx={{ width: 120, backgroundColor: '#ffffff' }}
                              inputProps={{ min: 0, max: bill.maxAmount, step: 'any' }}
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
            {selectedSupplier && (
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
              type="date"
              label="Payment Date"
              size="small"
              value={paymentDate}
              onChange={(e) => setPaymentDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
              fullWidth
            />

            <TextField
              label="Transaction ID / Cheque Ref #"
              size="small"
              value={referenceNumber}
              onChange={(e) => setReferenceNumber(e.target.value)}
              fullWidth
            />

            {/* Computed Auto-Summed Amount */}
            <TextField
              label="Total Amount Paid (₹)"
              size="small"
              type="number"
              value={totalAmountPaid}
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
              Record Payment
            </Button>
          </Box>
        </form>
      </CommonModal>
    </Box>
  );
};

export default VendorPayments;
