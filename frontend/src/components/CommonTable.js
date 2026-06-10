import React, { useState } from 'react';
import {
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  TableSortLabel, TablePagination, Paper, IconButton, Tooltip, Box,
  TextField, InputAdornment
} from '@mui/material';
import {
  Search as SearchIcon,
  Visibility as ViewIcon,
  Edit as EditIcon,
  Block as DeactivateIcon,
  CheckCircleOutline as ActivateIcon
} from '@mui/icons-material';

const CommonTable = ({
  columns = [],
  rows = [],
  actions = [], // Array of { label, icon, onClick, color, condition }
  searchPlaceholder = "Search records...",
  searchKey = "name",
  tableActions = null
}) => {
  const [order, setOrder] = useState('asc');
  const [orderBy, setOrderBy] = useState('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [searchQuery, setSearchQuery] = useState('');

  const handleRequestSort = (property) => {
    const isAsc = orderBy === property && order === 'asc';
    setOrder(isAsc ? 'desc' : 'asc');
    setOrderBy(property);
  };

  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  // Helper for sorting
  function descendingComparator(a, b, orderBy) {
    if (b[orderBy] < a[orderBy]) return -1;
    if (b[orderBy] > a[orderBy]) return 1;
    return 0;
  }

  function getComparator(order, orderBy) {
    return order === 'desc'
      ? (a, b) => descendingComparator(a, b, orderBy)
      : (a, b) => -descendingComparator(a, b, orderBy);
  }

  const sortedRows = [...rows].sort(getComparator(order, orderBy));

  const filteredRows = sortedRows.filter((row) => {
    if (!searchQuery) return true;
    const value = row[searchKey];
    return value && value.toString().toLowerCase().includes(searchQuery.toLowerCase());
  });

  const paginatedRows = filteredRows.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

  const getActionIcon = (type) => {
    switch (type) {
      case 'view': return <ViewIcon />;
      case 'edit': return <EditIcon />;
      case 'deactivate': return <DeactivateIcon />;
      case 'activate': return <ActivateIcon />;
      default: return null;
    }
  };

  return (
    <Paper sx={{ width: '100%', overflow: 'hidden', mb: 2 }}>
      {(searchKey || tableActions) && (
        <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
          <Box sx={{ display: 'flex', flexGrow: 1 }}>
            {searchKey && (
              <TextField
                size="small"
                placeholder={searchPlaceholder}
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setPage(0);
                }}
                sx={{ width: 280 }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon fontSize="small" sx={{ color: 'text.secondary' }} />
                    </InputAdornment>
                  ),
                }}
              />
            )}
          </Box>
          {tableActions && (
            <Box sx={{ display: 'flex', gap: 1 }}>
              {tableActions}
            </Box>
          )}
        </Box>
      )}
      <TableContainer>
        <Table stickyHeader>
          <TableHead>
            <TableRow>
              {columns.map((column) => (
                <TableCell
                  key={column.id}
                  align={column.align || 'left'}
                  sortDirection={orderBy === column.id ? order : false}
                  sx={{ backgroundColor: '#f8fafc', fontWeight: 600 }}
                >
                  {column.sortable !== false ? (
                    <TableSortLabel
                      active={orderBy === column.id}
                      direction={orderBy === column.id ? order : 'asc'}
                      onClick={() => handleRequestSort(column.id)}
                    >
                      {column.label}
                    </TableSortLabel>
                  ) : (
                    column.label
                  )}
                </TableCell>
              ))}
              {actions.length > 0 && (
                <TableCell align="right" sx={{ backgroundColor: '#f8fafc', fontWeight: 600, whiteSpace: 'nowrap' }}>
                  Actions
                </TableCell>
              )}
            </TableRow>
          </TableHead>
          <TableBody>
            {paginatedRows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length + (actions.length > 0 ? 1 : 0)} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                  No matching records found.
                </TableCell>
              </TableRow>
            ) : (
              paginatedRows.map((row, index) => (
                <TableRow hover key={row.id || index}>
                  {columns.map((column) => {
                    const val = row[column.id];
                    return (
                      <TableCell key={column.id} align={column.align || 'left'}>
                        {column.render ? column.render(row) : val}
                      </TableCell>
                    );
                  })}
                  {actions.length > 0 && (
                    <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                      {actions.map((act, actIdx) => {
                        const show = act.condition ? act.condition(row) : true;
                        if (!show) return null;
                        return (
                          <Tooltip key={actIdx} title={act.label}>
                            <IconButton
                              size="small"
                              color={act.color || 'default'}
                              onClick={() => act.onClick(row)}
                              sx={{ ml: 0.5 }}
                            >
                              {act.icon || getActionIcon(act.type)}
                            </IconButton>
                          </Tooltip>
                        );
                      })}
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>
      <TablePagination
        rowsPerPageOptions={[5, 10, 25, 50]}
        component="div"
        count={filteredRows.length}
        rowsPerPage={rowsPerPage}
        page={page}
        onPageChange={handleChangePage}
        onRowsPerPageChange={handleChangeRowsPerPage}
      />
    </Paper>
  );
};

export default CommonTable;
