import React from 'react';
import { Box, Typography, Breadcrumbs, Link } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import { NavigateNext as NavigateNextIcon } from '@mui/icons-material';

const PageHeader = ({
  title,
  breadcrumbs = [], // [{ label: "Home", to: "/" }]
  actions
}) => {
  if (!actions) return null;
  return (
    <Box
      sx={{
        display: 'flex',
        justifyContent: 'flex-end',
        mb: 2,
        mt: -1
      }}
    >
      <Box sx={{ display: 'flex', gap: 1 }}>{actions}</Box>
    </Box>
  );
};

export default PageHeader;
