import React from 'react';
import { Box, Typography, Breadcrumbs, Link } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import { NavigateNext as NavigateNextIcon } from '@mui/icons-material';

const PageHeader = ({
  title,
  breadcrumbs = [], // [{ label: "Home", to: "/" }]
  actions
}) => {
  return (
    <Box
      sx={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        mb: 3,
        flexWrap: 'wrap',
        gap: 2
      }}
    >
      <Box>
        <Typography variant="h2" sx={{ fontSize: '1.5rem', fontWeight: 700, mb: 0.5 }}>
          {title}
        </Typography>
        {breadcrumbs.length > 0 && (
          <Breadcrumbs
            separator={<NavigateNextIcon fontSize="small" />}
            aria-label="breadcrumb"
            sx={{ fontSize: '0.825rem' }}
          >
            {breadcrumbs.map((crumb, index) => {
              const isLast = index === breadcrumbs.length - 1;
              return isLast ? (
                <Typography key={index} color="text.secondary" sx={{ fontSize: '0.825rem' }}>
                  {crumb.label}
                </Typography>
              ) : (
                <Link
                  key={index}
                  component={RouterLink}
                  to={crumb.to}
                  underline="hover"
                  color="inherit"
                >
                  {crumb.label}
                </Link>
              );
            })}
          </Breadcrumbs>
        )}
      </Box>
      <Box sx={{ display: 'flex', gap: 1 }}>{actions}</Box>
    </Box>
  );
};

export default PageHeader;
