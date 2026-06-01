import React, { useState, useEffect } from 'react';
import { Button, Box, Alert, Typography, Tabs, Tab, Paper, Grid, MenuItem, TextField, Table, TableHead, TableRow, TableCell, TableBody, IconButton } from '@mui/material';
import { Add as AddIcon, Delete as DeleteIcon, AssignmentTurnedIn as ReceiveIcon, Receipt as BillIcon } from '@mui/icons-material';

import apiClient from '../../api/client';
import PageHeader from '../../components/PageHeader';
import CommonTable from '../../components/CommonTable';
import CommonModal from '../../components/CommonModal';

const Purchase = () => {
  const [tabIndex, setTabIndex] = useState(0);
  const [pos, setPos] = useState([]);
  const [grns, setGrns] = useState([]);
  const [bills, setBills] = useState([]);
  const [products, setProducts] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [branches, setBranches] = useState([]);
  
  const [openPOModal, setOpenPOModal] = useState(false);
  const [openGRNModal, setOpenGRNModal] = useState(false);
  const [openBillModal, setOpenBillModal] = useState(false);
  
  const [selectedPO, setSelectedPO] = useState(null);
  const [selectedGRN, setSelectedGRN] = useState(null);
  
  // Purchase Order form local states
  const [poSupplierId, setPoSupplierId] = useState('');
  const [poBranchId, setPoBranchId] = useState('');
  const [poItems, setPoItems] = useState([{ product_id: '', qty: 1, rate: 0, tax_rate: 18 }]);
  
  // GRN received quantities local state
  const [grnItems, setGrnItems] = useState([]);
  
  // Bill local states
  const [billInvoiceNo, setBillInvoiceNo] = useState('');
  const [billDueDate, setBillDueDate] = useState('');

  const [error, setError] = useState(null);

  const loadData = async () => {
    try {
      const poRes = await apiClient.get('/purchase/po');
      const grnRes = await apiClient.get('/purchase/grn');
      const billRes = await apiClient.get('/purchase/bills');
      const prodRes = await apiClient.get('/products/');
      const supRes = await apiClient.get('/suppliers/');
      const brRes = await apiClient.get('/admin/branches');

      setPos(poRes.data);
      setGrns(grnRes.data);
      setBills(billRes.data);
      setProducts(prodRes.data);
      setSuppliers(supRes.data);
      setBranches(brRes.data);
    } catch (err) {
      setError('Failed to load transaction data records.');
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleOpenAddPO = () => {
    setPoSupplierId(suppliers.length > 0 ? suppliers[0].id : '');
    setPoBranchId(branches.length > 0 ? branches[0].id : '');
    setPoItems([{ product_id: products.length > 0 ? products[0].id : '', qty: 1, rate: 0, tax_rate: 18 }]);
    setOpenPOModal(true);
  };

  const handleAddItemRow = () => {
    setPoItems([...poItems, { product_id: products.length > 0 ? products[0].id : '', qty: 1, rate: 0, tax_rate: 18 }]);
  };

  const handleRemoveItemRow = (idx) => {
    setPoItems(poItems.filter((_, i) => i !== idx));
  };

  const handleItemChange = (idx, field, value) => {
    setPoItems(
      poItems.map((item, i) => {
        if (i === idx) {
          const updated = { ...item, [field]: value };
          if (field === 'product_id') {
            const p = products.find((prod) => prod.id === value);
            if (p) {
              updated.rate = p.purchase_price;
              updated.tax_rate = p.tax_rate;
            }
          }
          return updated;
        }
        return item;
      })
    );
  };

  const submitPO = async () => {
    try {
      const payload = {
        supplier_id: poSupplierId,
        branch_id: poBranchId,
        items: poItems
      };
      await apiClient.post('/purchase/po', payload);
      setOpenPOModal(false);
      loadData();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to submit Purchase Order.');
    }
  };

  // ==========================================
  // GRN FLOWS
  // ==========================================
  const handleOpenReceive = (po) => {
    setSelectedPO(po);
    const items = po.items.map((item) => ({
      product_id: item.product_id,
      po_item_id: item.id,
      qty_ordered: item.qty,
      qty_received: item.qty,
      warehouse_location: 'Main Rack A'
    }));
    setGrnItems(items);
    setOpenGRNModal(true);
  };

  const handleGRNQtyChange = (idx, qty) => {
    setGrnItems(grnItems.map((item, i) => (i === idx ? { ...item, qty_received: parseFloat(qty) || 0 } : item)));
  };

  const handleGRNRackChange = (idx, val) => {
    setGrnItems(grnItems.map((item, i) => (i === idx ? { ...item, warehouse_location: val } : item)));
  };

  const submitGRN = async () => {
    try {
      const payload = {
        purchase_order_id: selectedPO.id,
        branch_id: selectedPO.branch_id,
        items: grnItems
      };
      await apiClient.post('/purchase/grn', payload);
      setOpenGRNModal(false);
      loadData();
    } catch (err) {
      setError('Failed to log Goods Receipt Note.');
    }
  };

  // ==========================================
  // VENDOR BILL FLOWS
  // ==========================================
  const handleOpenBill = (grn) => {
    setSelectedGRN(grn);
    setBillInvoiceNo(f"INV-{grn.id.hex[:6].toUpperCase()}");
    setBillDueDate(new Date(Date.now() + 15 * 86400000).toISOString().split('T')[0]);
    setOpenBillModal(true);
  };

  const submitBill = async () => {
    try {
      // Find corresponding PO total amount
      const po = pos.find((p) => p.id === selectedGRN.purchase_order_id);
      const payload = {
        grn_id: selectedGRN.id,
        supplier_id: selectedGRN.purchase_order_id ? po.supplier_id : '',
        branch_id: selectedGRN.branch_id,
        invoice_number: billInvoiceNo,
        due_date: new Date(billDueDate).toISOString(),
        payment_terms: "15 Days Net",
        subtotal: po ? po.total_amount : 0,
        tax_amount: po ? po.tax_amount : 0,
        total_amount: po ? po.grand_total : 0
      };

      await apiClient.post('/purchase/bills', payload);
      setOpenBillModal(false);
      loadData();
    } catch (err) {
      setError('Failed to log Supplier Invoice Bill.');
    }
  };

  const poColumns = [
    { id: 'date', label: 'Order Date', render: (row) => new Date(row.date).toLocaleDateString() },
    {
      id: 'supplier_id',
      label: 'Supplier',
      render: (row) => {
        const s = suppliers.find((sup) => sup.id === row.supplier_id);
        return s ? s.name : 'Unknown';
      }
    },
    {
      id: 'branch_id',
      label: 'Branch Office',
      render: (row) => {
        const b = branches.find((br) => br.id === row.branch_id);
        return b ? b.branch_name : 'Global';
      }
    },
    { id: 'grand_total', label: 'Total Value', render: (row) => `$${row.grand_total.toFixed(2)}` },
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
            backgroundColor:
              row.status === 'Received' ? 'rgba(45, 106, 79, 0.1)' :
              row.status === 'Draft' ? 'rgba(100, 116, 139, 0.1)' : 'rgba(255, 143, 0, 0.1)',
            color:
              row.status === 'Received' ? '#2d6a4f' :
              row.status === 'Draft' ? '#64748b' : '#ff8f00',
          }}
        >
          {row.status}
        </Typography>
      )
    }
  ];

  const grnColumns = [
    { id: 'date', label: 'Received Date', render: (row) => new Date(row.date).toLocaleDateString() },
    {
      id: 'purchase_order_id',
      label: 'Linked PO Ref',
      render: (row) => `PO-${row.purchase_order_id.hex[:6].toUpperCase()}`
    },
    {
      id: 'branch_id',
      label: 'Branch',
      render: (row) => {
        const b = branches.find((br) => br.id === row.branch_id);
        return b ? b.branch_name : 'Global';
      }
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
            backgroundColor: 'rgba(45, 106, 79, 0.1)',
            color: '#2d6a4f',
          }}
        >
          {row.status}
        </Typography>
      )
    }
  ];

  const billColumns = [
    { id: 'billing_date', label: 'Bill Date', render: (row) => new Date(row.billing_date).toLocaleDateString() },
    { id: 'invoice_number', label: 'Supplier Invoice #' },
    {
      id: 'supplier_id',
      label: 'Supplier Name',
      render: (row) => {
        const s = suppliers.find((sup) => sup.id === row.supplier_id);
        return s ? s.name : 'Unknown';
      }
    },
    { id: 'total_amount', label: 'Bill Value', render: (row) => `$${row.total_amount.toFixed(2)}` },
    {
      id: 'status',
      label: 'Payment Status',
      render: (row) => (
        <Typography
          variant="caption"
          sx={{
            px: 1,
            py: 0.5,
            borderRadius: '4px',
            fontWeight: 600,
            backgroundColor: row.status === 'Paid' ? 'rgba(45, 106, 79, 0.1)' : 'rgba(217, 4, 41, 0.1)',
            color: row.status === 'Paid' ? '#2d6a4f' : '#d90429',
          }}
        >
          {row.status}
        </Typography>
      )
    }
  ];

  // Calculate dynamic PO grand sums
  const poTotalAmountSum = poItems.reduce((acc, item) => acc + (parseFloat(item.qty) || 0) * (parseFloat(item.rate) || 0), 0);
  const poTotalTaxSum = poItems.reduce((acc, item) => acc + ((parseFloat(item.qty) || 0) * (parseFloat(item.rate) || 0) * (parseFloat(item.tax_rate) || 18) / 100), 0);

  return (
    <Box>
      <PageHeader
        title="Purchase Module"
        breadcrumbs={[
          { label: 'Dashboard', to: '/' },
          { label: 'Purchase Module' },
        ]}
        actions={
          tabIndex === 0 && (
            <Button variant="contained" startIcon={<AddIcon />} onClick={handleOpenAddPO}>
              Create Purchase Order
            </Button>
          )
        }
      />

      {error && (
        <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      <Paper sx={{ mb: 3, borderRadius: '8px' }}>
        <Tabs value={tabIndex} onChange={(e, idx) => setTabIndex(idx)} sx={{ px: 2, borderBottom: '1px solid #e2e8f0' }}>
          <Tab label="Purchase Orders" sx={{ fontWeight: 600 }} />
          <Tab label="Goods Receipt Notes (GRN)" sx={{ fontWeight: 600 }} />
          <Tab label="Purchase Entries (Bills)" sx={{ fontWeight: 600 }} />
        </Tabs>
      </Paper>

      {tabIndex === 0 && (
        <CommonTable
          columns={poColumns}
          rows={pos}
          actions={[
            {
              icon: <ReceiveIcon />,
              label: 'Goods Receipt Note (GRN)',
              condition: (row) => row.status === 'Draft',
              onClick: handleOpenReceive,
              color: 'success'
            }
          ]}
          searchKey="status"
        />
      )}

      {tabIndex === 1 && (
        <CommonTable
          columns={grnColumns}
          rows={grns}
          actions={[
            {
              icon: <BillIcon />,
              label: 'Purchase Entry Bill',
              onClick: handleOpenBill,
              color: 'primary'
            }
          ]}
          searchKey="status"
        />
      )}

      {tabIndex === 2 && (
        <CommonTable columns={billColumns} rows={bills} searchKey="invoice_number" />
      )}

      {/* PO CREATE MODAL */}
      <CommonModal
        open={openPOModal}
        onClose={() => setOpenPOModal(false)}
        title="Create Purchase Order"
        maxWidth="md"
      >
        <Grid container spacing={3} sx={{ mb: 3 }}>
          <Grid item xs={12} sm={6}>
            <TextField
              select
              label="Supplier Vendor"
              fullWidth
              value={poSupplierId}
              onChange={(e) => setPoSupplierId(e.target.value)}
            >
              {suppliers.map((s) => (
                <MenuItem key={s.id} value={s.id}>{s.name} ({s.code})</MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              select
              label="Ordering Branch"
              fullWidth
              value={poBranchId}
              onChange={(e) => setPoBranchId(e.target.value)}
            >
              {branches.map((b) => (
                <MenuItem key={b.id} value={b.id}>{b.branch_name} ({b.code})</MenuItem>
              ))}
            </TextField>
          </Grid>
        </Grid>

        <Typography variant="subtitle1" color="primary.main" sx={{ fontWeight: 600, mb: 2 }}>
          Purchase Order Line Items
        </Typography>

        <TableContainer component={Paper} variant="outlined" sx={{ mb: 3 }}>
          <Table>
            <TableHead>
              <TableRow sx={{ backgroundColor: '#f8fafc' }}>
                <TableCell sx={{ fontWeight: 600 }}>Product</TableCell>
                <TableCell align="center" sx={{ fontWeight: 600, width: 100 }}>Qty</TableCell>
                <TableCell align="center" sx={{ fontWeight: 600, width: 140 }}>Rate ($)</TableCell>
                <TableCell align="center" sx={{ fontWeight: 600, width: 100 }}>GST %</TableCell>
                <TableCell align="right" sx={{ fontWeight: 600 }}>Total ($)</TableCell>
                <TableCell align="center" sx={{ width: 60 }}></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {poItems.map((item, idx) => (
                <TableRow key={idx}>
                  <TableCell>
                    <TextField
                      select
                      size="small"
                      fullWidth
                      value={item.product_id}
                      onChange={(e) => handleItemChange(idx, 'product_id', e.target.value)}
                    >
                      {products.map((p) => (
                        <MenuItem key={p.id} value={p.id}>{p.name}</MenuItem>
                      ))}
                    </TextField>
                  </TableCell>
                  <TableCell>
                    <TextField
                      type="number"
                      size="small"
                      value={item.qty}
                      onChange={(e) => handleItemChange(idx, 'qty', parseInt(e.target.value) || 0)}
                    />
                  </TableCell>
                  <TableCell>
                    <TextField
                      type="number"
                      size="small"
                      value={item.rate}
                      onChange={(e) => handleItemChange(idx, 'rate', parseFloat(e.target.value) || 0)}
                    />
                  </TableCell>
                  <TableCell>
                    <TextField
                      type="number"
                      size="small"
                      value={item.tax_rate}
                      onChange={(e) => handleItemChange(idx, 'tax_rate', parseFloat(e.target.value) || 0)}
                    />
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 600 }}>
                    {((item.qty * item.rate) * (1 + item.tax_rate / 100)).toFixed(2)}
                  </TableCell>
                  <TableCell align="center">
                    <IconButton color="error" size="small" onClick={() => handleRemoveItemRow(idx)} disabled={poItems.length === 1}>
                      <DeleteIcon />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>

        <Button variant="outlined" startIcon={<AddIcon />} onClick={handleAddItemRow} sx={{ mb: 4 }}>
          Add Item Row
        </Button>

        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 1, borderTop: '1px solid #e2e8f0', pt: 2, mb: 4 }}>
          <Typography variant="body1">Subtotal: <strong>${poTotalAmountSum.toFixed(2)}</strong></Typography>
          <Typography variant="body1">Taxes (GST): <strong>${poTotalTaxSum.toFixed(2)}</strong></Typography>
          <Typography variant="h6" color="primary.main">Grand Total: <strong>${(poTotalAmountSum + poTotalTaxSum).toFixed(2)}</strong></Typography>
        </Box>

        <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
          <Button onClick={() => setOpenPOModal(false)} variant="outlined">Cancel</Button>
          <Button onClick={submitPO} variant="contained">Submit PO</Button>
        </Box>
      </CommonModal>

      {/* GRN RECORD MODAL */}
      <CommonModal
        open={openGRNModal}
        onClose={() => setOpenGRNModal(false)}
        title="Record Goods Receipt Note"
        maxWidth="md"
      >
        <Typography variant="body1" sx={{ mb: 3 }}>
          Order reference: <strong>PO-{selectedPO?.id.hex[:6].toUpperCase()}</strong>
        </Typography>

        <TableContainer component={Paper} variant="outlined" sx={{ mb: 3 }}>
          <Table>
            <TableHead>
              <TableRow sx={{ backgroundColor: '#f8fafc' }}>
                <TableCell sx={{ fontWeight: 600 }}>Product</TableCell>
                <TableCell align="center" sx={{ fontWeight: 600 }}>Ordered Qty</TableCell>
                <TableCell align="center" sx={{ fontWeight: 600, width: 140 }}>Received Qty</TableCell>
                <TableCell align="center" sx={{ fontWeight: 600 }}>Warehouse Rack</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {grnItems.map((item, idx) => {
                const prod = products.find((p) => p.id === item.product_id);
                return (
                  <TableRow key={idx}>
                    <TableCell sx={{ fontWeight: 600 }}>{prod ? prod.name : 'Unknown'}</TableCell>
                    <TableCell align="center">{item.qty_ordered}</TableCell>
                    <TableCell align="center">
                      <TextField
                        type="number"
                        size="small"
                        value={item.qty_received}
                        onChange={(e) => handleGRNQtyChange(idx, e.target.value)}
                      />
                    </TableCell>
                    <TableCell>
                      <TextField
                        size="small"
                        fullWidth
                        value={item.warehouse_location}
                        onChange={(e) => handleGRNRackChange(idx, e.target.value)}
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>

        <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, mt: 3 }}>
          <Button onClick={() => setOpenGRNModal(false)} variant="outlined">Cancel</Button>
          <Button onClick={submitGRN} variant="contained">Post GRN Stock</Button>
        </Box>
      </CommonModal>

      {/* BILL LOG MODAL */}
      <CommonModal
        open={openBillModal}
        onClose={() => setOpenBillModal(false)}
        title="Finalize Supplier Invoice Bill"
      >
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <TextField
            label="Supplier Invoice Number"
            fullWidth
            value={billInvoiceNo}
            onChange={(e) => setBillInvoiceNo(e.target.value)}
          />
          <TextField
            label="Payment Due Date"
            type="date"
            fullWidth
            InputLabelProps={{ shrink: true }}
            value={billDueDate}
            onChange={(e) => setBillDueDate(e.target.value)}
          />
        </Box>
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, mt: 4 }}>
          <Button onClick={() => setOpenBillModal(false)} variant="outlined">Cancel</Button>
          <Button onClick={submitBill} variant="contained">Post Vendor Bill</Button>
        </Box>
      </CommonModal>
    </Box>
  );
};

export default Purchase;
