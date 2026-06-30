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
        mt: -1,
        width: '100%'
      }}
    >
      <Box
        sx={{
          display: 'flex',
          gap: 1,
          flexWrap: 'wrap',
          justifyContent: { xs: 'flex-start', sm: 'flex-end' },
          width: { xs: '100%', sm: 'auto' }
        }}
      >
        {actions}
      </Box>
    </Box>
  );
};

export default PageHeader;
