import React, { useState, useEffect } from 'react';
import {
  Box, Grid, Paper, Typography, CircularProgress, Alert, Table,
  TableBody, TableCell, TableContainer, TableHead, TableRow
} from '@mui/material';
import {
  TrendingUp as SalesIcon,
  AccountBalanceWallet as OutstandingIcon,
  Warning as LowStockIcon,
  MonetizationOn as RevenueIcon
} from '@mui/icons-material';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts';

import apiClient from '../../api/client';
import PageHeader from '../../components/PageHeader';

const COLORS = ['#1b4332', '#40916c', '#52b788', '#74c69d', '#95d5b2', '#b7e4c7'];

const formatIndianCurrency = (val) => {
  if (val === undefined || val === null || isNaN(val)) return '0.00';
  return Number(val).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
};

const ReportsDashboard = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadDashboard = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get('/reports/dashboard');
      setData(res.data);
    } catch (err) {
      setError('Failed to load reports dashboard analytics.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', minHeight: '50vh', alignItems: 'center', justifyContent: 'center' }}>
        <CircularProgress color="primary" />
      </Box>
    );
  }

  if (error || !data) {
    return (
      <Box sx={{ p: 2 }}>
        <Alert severity="error">{error || 'Failed to retrieve dashboard metrics.'}</Alert>
      </Box>
    );
  }

  const kpiCards = [
    { label: "Today's Sales", value: `₹${formatIndianCurrency(data.kpis.today_sales)}`, icon: <SalesIcon />, color: '#1b4332', bg: 'rgba(27, 67, 50, 0.05)' },
    { label: "Monthly Sales", value: `₹${formatIndianCurrency(data.kpis.monthly_sales)}`, icon: <RevenueIcon />, color: '#40916c', bg: 'rgba(64, 145, 108, 0.05)' },
    { label: "Outstanding Payments", value: `₹${formatIndianCurrency(data.kpis.outstanding_payments)}`, icon: <OutstandingIcon />, color: '#ff8f00', bg: 'rgba(255, 143, 0, 0.05)' },
    { label: "Low Stock Items", value: data.kpis.low_stock_count, icon: <LowStockIcon />, color: '#d90429', bg: 'rgba(217, 4, 41, 0.05)' }
  ];

  return (
    <Box>
      <PageHeader
        title="Reports Analytics"
        breadcrumbs={[
          { label: 'Dashboard', to: '/' },
          { label: 'Reports Dashboard' },
        ]}
      />

      {/* KPI Cards Grid */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        {kpiCards.map((card, idx) => (
          <Grid item xs={12} sm={6} md={3} key={idx}>
            <Paper
              sx={{
                p: 3,
                borderRadius: '16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                backgroundColor: '#ffffff',
                border: '1px solid #e2e8f0',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.02)'
              }}
            >
              <Box>
                <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600, mb: 1 }}>
                  {card.label}
                </Typography>
                <Typography variant="h3" sx={{ fontSize: '1.625rem', fontWeight: 800, color: '#1e293b' }}>
                  {card.value}
                </Typography>
              </Box>
              <Box
                sx={{
                  p: 1.5,
                  borderRadius: '12px',
                  backgroundColor: card.bg,
                  color: card.color,
                  display: 'flex'
                }}
              >
                {card.icon}
              </Box>
            </Paper>
          </Grid>
        ))}
      </Grid>

      {/* Charts Grid */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        {/* Monthly Sales Trend */}
        <Grid item xs={12} md={8}>
          <Paper sx={{ p: 3, borderRadius: '16px', border: '1px solid #e2e8f0' }}>
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 3 }}>
              Monthly Sales Trend (Last 12 Months)
            </Typography>
            <Box sx={{ width: '100%', height: 320 }}>
              <ResponsiveContainer>
                <BarChart data={data.monthly_sales_trend}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="month" tickLine={false} />
                  <YAxis tickLine={false} />
                  <Tooltip formatter={(value) => [`₹${formatIndianCurrency(value)}`, 'Sales']} />
                  <Bar dataKey="sales" fill="#1b4332" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Box>
          </Paper>
        </Grid>

        {/* Sales by Category */}
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 3, borderRadius: '16px', border: '1px solid #e2e8f0' }}>
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 3 }}>
              Sales by Category
            </Typography>
            <Box sx={{ width: '100%', height: 320, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ResponsiveContainer>
                <PieChart>
                  <Pie
                    data={data.sales_by_category}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={3}
                    dataKey="total_sales"
                    nameKey="category_name"
                  >
                    {data.sales_by_category.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => [`₹${formatIndianCurrency(value)}`, 'Sales']} />
                  <Legend verticalAlign="bottom" height={36} />
                </PieChart>
              </ResponsiveContainer>
            </Box>
          </Paper>
        </Grid>
      </Grid>

      {/* Tables Grid */}
      <Grid container spacing={3}>
        {/* Top Products */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3, borderRadius: '16px', border: '1px solid #e2e8f0' }}>
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
              Top 10 Selling Products
            </Typography>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ backgroundColor: '#f8fafc' }}>
                    <TableCell sx={{ fontWeight: 600 }}>Product</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 600 }}>Qty Sold</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 600 }}>Total Revenue</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {data.top_products.map((row, idx) => (
                    <TableRow key={idx} hover>
                      <TableCell sx={{ py: 1.5 }}>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>{row.product_name}</Typography>
                        <Typography variant="caption" color="text.secondary">{row.sku}</Typography>
                      </TableCell>
                      <TableCell align="center">{row.qty_sold}</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 600 }}>₹{formatIndianCurrency(row.total_revenue)}</TableCell>
                    </TableRow>
                  ))}
                  {data.top_products.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={3} align="center" sx={{ py: 3, color: 'text.secondary' }}>
                        No product sales recorded yet.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </Grid>

        {/* Recent Transactions */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3, borderRadius: '16px', border: '1px solid #e2e8f0' }}>
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
              Recent Transactions Ledger
            </Typography>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ backgroundColor: '#f8fafc' }}>
                    <TableCell sx={{ fontWeight: 600 }}>Details</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 600 }}>Date</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 600 }}>Value</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {data.recent_transactions.map((row, idx) => (
                    <TableRow key={idx} hover>
                      <TableCell sx={{ py: 1.5 }}>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>{row.party_name}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {row.tx_type} | {row.reference_no}
                        </Typography>
                      </TableCell>
                      <TableCell align="center" sx={{ fontSize: '0.825rem' }}>
                        {new Date(row.date).toLocaleDateString()}
                      </TableCell>
                      <TableCell align="right" sx={{ fontWeight: 600 }}>
                        ₹{formatIndianCurrency(row.amount)}
                      </TableCell>
                    </TableRow>
                  ))}
                  {data.recent_transactions.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={3} align="center" sx={{ py: 3, color: 'text.secondary' }}>
                        No transactions found.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};

export default ReportsDashboard;
