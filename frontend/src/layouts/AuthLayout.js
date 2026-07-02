import React from 'react';
import { Outlet } from 'react-router-dom';
import { Box, Paper, Typography } from '@mui/material';

const AuthLayout = () => {
  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #0b1c15 0%, #1b4332 100%)', // Forest dark rich green gradient
        p: 2,
      }}
    >
      <Paper
        elevation={6}
        sx={{
          width: '100%',
          maxWidth: 440,
          p: 4,
          borderRadius: '16px',
          boxShadow: '0 12px 40px rgba(0, 0, 0, 0.25)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          backgroundColor: 'rgba(255, 255, 255, 0.96)',
          backdropFilter: 'blur(10px)',
          textAlign: 'center',
        }}
      >
        <Box sx={{ mb: 4, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1.5 }}>
          <Box
            component="img"
            src="/logo.svg"
            alt="OrbX Logo"
            sx={{
              height: 94,
              width: 'auto',
              filter: 'drop-shadow(0px 4px 10px rgba(27, 67, 50, 0.15))',
              animation: 'pulse 3s infinite ease-in-out',
              '@keyframes pulse': {
                '0%, 100%': { transform: 'scale(1)' },
                '50%': { transform: 'scale(1.06)' },
              }
            }}
          />
          <Box>
            <Typography
              variant="h4"
              sx={{
                fontWeight: 800,
                color: 'primary.main',
                letterSpacing: '-0.5px',
                mb: 0.5,
              }}
            >
              OrbX
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Enterprise Resource Planning Suite
            </Typography>
          </Box>
        </Box>
        
        <Outlet />
      </Paper>
    </Box>
  );
};

export default AuthLayout;
