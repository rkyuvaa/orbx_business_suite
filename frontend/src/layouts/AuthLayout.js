import React from 'react';
import { Outlet, Link as RouterLink } from 'react-router-dom';
import { Box, Paper, Typography, Link } from '@mui/material';
import { Launch as LaunchIcon } from '@mui/icons-material';
import { ORBX_WEBSITE_URL, PRIVACY_POLICY_ROUTE, TERMS_OF_SERVICE_ROUTE } from '../config';

const AuthLayout = () => {
  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: { xs: 'column', md: 'row' },
        background: 'linear-gradient(135deg, #0b1c15 0%, #1b4332 100%)', // Brand Green Gradient
      }}
    >
      {/* Left Panel - Desktop Only */}
      <Box
        sx={{
          display: { xs: 'none', md: 'flex' },
          flexDirection: 'column',
          justifyContent: 'space-between',
          width: { md: '50%', lg: '55%' },
          p: { md: 6, lg: 8, xl: 10 },
          borderRight: '1px solid rgba(255, 255, 255, 0.08)',
          color: '#ffffff',
        }}
      >
        {/* Top Header Section */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Box
            component="img"
            src="/logo_dark.svg"
            alt="OrbX Logo"
            sx={{ height: 100, width: 'auto' }}
          />
          <Box
            sx={{
              px: 1.5,
              py: 0.5,
              borderRadius: '6px',
              border: '1px solid rgba(82, 183, 136, 0.4)',
              backgroundColor: 'rgba(82, 183, 136, 0.1)',
              color: '#52b788',
              fontSize: '0.75rem',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '1px',
              display: 'inline-flex',
              alignItems: 'center',
            }}
          >
            ERP
          </Box>
        </Box>

        {/* Middle Content Section */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, my: 'auto' }}>
          <Typography
            variant="overline"
            sx={{
              color: '#52b788',
              fontWeight: 800,
              letterSpacing: '2px',
              fontSize: '0.85rem',
            }}
          >
            WHERE BUSINESS MEETS INTELLIGENCE
          </Typography>

          <Typography
            variant="h3"
            sx={{
              fontWeight: 800,
              lineHeight: 1.2,
              color: '#ffffff',
              letterSpacing: '-0.5px',
              maxWidth: 500,
            }}
          >
            Run your entire enterprise on one intelligent platform.
          </Typography>

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2 }}>
            {[
              '360° Business View',
              'AI Powered Insights',
              'ERP Unified Platform',
              'Secure Enterprise Ready',
              'Built for modern businesses',
            ].map((text, idx) => (
              <Box key={idx} sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 24,
                    height: 24,
                    borderRadius: '50%',
                    backgroundColor: 'rgba(82, 183, 136, 0.15)',
                    color: '#52b788',
                  }}
                >
                  <svg width="12" height="9" viewBox="0 0 12 9" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M1 4L4.5 7.5L11 1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </Box>
                <Typography
                  variant="body1"
                  sx={{
                    color: 'rgba(255, 255, 255, 0.85)',
                    fontWeight: 500,
                    fontSize: '1rem',
                  }}
                >
                  {text}
                </Typography>
              </Box>
            ))}
          </Box>
        </Box>

        {/* Bottom Section */}
        <Box
          sx={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: 1.5,
            borderTop: '1px solid rgba(255, 255, 255, 0.08)',
            pt: 4,
          }}
        >
          <Link
            href={ORBX_WEBSITE_URL}
            target="_blank"
            rel="noopener noreferrer"
            sx={{
              color: 'rgba(255, 255, 255, 0.7)',
              textDecoration: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 0.5,
              fontWeight: 600,
              fontSize: '1rem',
              position: 'relative',
              transition: 'color 200ms ease-in-out',
              '&:hover': {
                color: '#52b788',
                '& .ext-icon': {
                  transform: 'translate(2px, -2px)',
                },
                '&::after': {
                  transform: 'scaleX(1)',
                }
              },
              '&::after': {
                content: '""',
                position: 'absolute',
                width: '100%',
                transform: 'scaleX(0)',
                height: '1.5px',
                bottom: -2,
                left: 0,
                backgroundColor: '#52b788',
                transformOrigin: 'bottom left',
                transition: 'transform 200ms ease-in-out',
              },
              '&:focus-visible': {
                outline: '2px solid #52b788',
                outlineOffset: '4px',
                borderRadius: '2px',
              }
            }}
          >
            orbx.in
            <LaunchIcon
              className="ext-icon"
              sx={{
                fontSize: '0.875rem',
                transition: 'transform 200ms ease-in-out',
              }}
            />
          </Link>
          <Typography
            variant="body2"
            sx={{
              color: 'rgba(255, 255, 255, 0.45)',
              fontWeight: 500,
              letterSpacing: '0.2px',
            }}
          >
            • &nbsp;Where Business Meets Intelligence
          </Typography>
        </Box>
      </Box>

      {/* Right Panel - Login Card & Subtle Footer */}
      <Box
        sx={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          alignItems: 'center',
          p: { xs: 2, sm: 3, md: 4 },
          minHeight: '100vh',
        }}
      >
        {/* Top spacer to balance layout */}
        <Box sx={{ height: { xs: 10, md: 20 } }} />

        {/* Centered Login Card */}
        <Paper
          elevation={6}
          sx={{
            width: '100%',
            maxWidth: 440,
            p: { xs: 2.5, sm: 3.5 },
            borderRadius: '16px',
            boxShadow: '0 12px 40px rgba(0, 0, 0, 0.25)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            backgroundColor: 'rgba(255, 255, 255, 0.96)',
            backdropFilter: 'blur(10px)',
            textAlign: 'center',
          }}
        >
          <Box sx={{ mb: 2.5, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1.5 }}>
            <Box
              component="img"
              src="/logo_light.svg"
              alt="OrbX Logo"
              sx={{
                width: '100%',
                maxWidth: { xs: 180, sm: 220, md: 260 },
                height: 'auto',
                filter: 'drop-shadow(0px 4px 10px rgba(27, 67, 50, 0.15))',
                animation: 'pulse 3s infinite ease-in-out',
                '@keyframes pulse': {
                  '0%, 100%': { transform: 'scale(1)' },
                  '50%': { transform: 'scale(1.06)' },
                }
              }}
            />
            <Box>
              <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>
                Enterprise Resource Planning Suite
              </Typography>
            </Box>
          </Box>

          <Outlet />
        </Paper>

        {/* Bottom Section: Subtle Footer */}
        <Box
          sx={{
            mt: 4,
            pb: { xs: 2, md: 0 },
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 1.5,
          }}
        >
          {/* Footer Links */}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 1.5,
              fontSize: '0.8rem',
              color: 'rgba(255, 255, 255, 0.5)',
            }}
          >
            <Link
              href={ORBX_WEBSITE_URL}
              target="_blank"
              rel="noopener noreferrer"
              sx={{
                color: 'inherit',
                textDecoration: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 0.5,
                fontWeight: 500,
                position: 'relative',
                transition: 'color 200ms ease-in-out',
                '&:hover': {
                  color: '#52b788',
                  '& .ext-icon': {
                    transform: 'translate(2px, -2px)',
                  },
                  '&::after': {
                    transform: 'scaleX(1)',
                  }
                },
                '&::after': {
                  content: '""',
                  position: 'absolute',
                  width: '100%',
                  transform: 'scaleX(0)',
                  height: '1px',
                  bottom: -1,
                  left: 0,
                  backgroundColor: '#52b788',
                  transformOrigin: 'bottom left',
                  transition: 'transform 200ms ease-in-out',
                },
                '&:focus-visible': {
                  outline: '2px solid #52b788',
                  outlineOffset: '2px',
                  borderRadius: '2px',
                }
              }}
            >
              orbx.in
              <LaunchIcon
                className="ext-icon"
                sx={{
                  fontSize: '0.75rem',
                  transition: 'transform 200ms ease-in-out',
                }}
              />
            </Link>
            <Typography variant="caption" sx={{ opacity: 0.3 }}>•</Typography>
            <Link
              component={RouterLink}
              to={PRIVACY_POLICY_ROUTE}
              sx={{
                color: 'inherit',
                textDecoration: 'none',
                fontWeight: 500,
                transition: 'color 200ms ease-in-out',
                '&:hover': {
                  color: '#52b788',
                  textDecoration: 'underline',
                },
                '&:focus-visible': {
                  outline: '2px solid #52b788',
                  outlineOffset: '2px',
                  borderRadius: '2px',
                }
              }}
            >
              Privacy
            </Link>
            <Typography variant="caption" sx={{ opacity: 0.3 }}>•</Typography>
            <Link
              component={RouterLink}
              to={TERMS_OF_SERVICE_ROUTE}
              sx={{
                color: 'inherit',
                textDecoration: 'none',
                fontWeight: 500,
                transition: 'color 200ms ease-in-out',
                '&:hover': {
                  color: '#52b788',
                  textDecoration: 'underline',
                },
                '&:focus-visible': {
                  outline: '2px solid #52b788',
                  outlineOffset: '2px',
                  borderRadius: '2px',
                }
              }}
            >
              Terms
            </Link>
          </Box>
        </Box>
      </Box>
    </Box>
  );
};

export default AuthLayout;
