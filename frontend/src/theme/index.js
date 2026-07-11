import { createTheme } from '@mui/material/styles';

const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#1b4332',      // Deep forest green primary
      light: '#40916c',     // Rich mint green
      dark: '#081c15',      // Very dark green
      contrastText: '#ffffff',
    },
    secondary: {
      main: '#ff8f00',      // Deep amber for secondary accents/highlights
      light: '#ffb300',
      dark: '#c56000',
      contrastText: '#ffffff',
    },
    background: {
      default: '#f4f6f8',   // Modern cool grey background
      paper: '#ffffff',     // Sleek paper cards
    },
    success: {
      main: '#2d6a4f',
    },
    warning: {
      main: '#ffb703',
    },
    error: {
      main: '#d00000',
    },
    text: {
      primary: '#1e293b',
      secondary: '#64748b',
    },
  },
  typography: {
    fontFamily: [
      'system-ui',
      '-apple-system',
      'BlinkMacSystemFont',
      '"Segoe UI"',
      'Roboto',
      '"Helvetica Neue"',
      'Arial',
      'sans-serif',
    ].join(','),
    h1: {
      fontWeight: 700,
      fontSize: '2.25rem',
      color: '#1e293b',
    },
    h2: {
      fontWeight: 700,
      fontSize: '1.75rem',
      color: '#1e293b',
    },
    h3: {
      fontWeight: 600,
      fontSize: '1.5rem',
      color: '#1e293b',
    },
    h6: {
      fontWeight: 600,
      fontSize: '1rem',
      color: '#1e293b',
    },
    body1: {
      fontSize: '0.925rem',
      color: '#1e293b',
    },
    button: {
      textTransform: 'none', // Remove default uppercase
      fontWeight: 600,
    },
  },
  shape: {
    borderRadius: 8, // Modern rounded inputs and buttons
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: '8px',
          boxShadow: 'none',
          padding: '8px 16px',
          transition: 'all 0.2s ease-in-out',
          '&:hover': {
            boxShadow: '0px 4px 12px rgba(27, 67, 50, 0.15)',
            transform: 'translateY(-1px)',
          },
        },
        containedPrimary: {
          background: 'linear-gradient(135deg, #1b4332 0%, #2d6a4f 100%)',
          color: '#ffffff',
          '&:hover': {
            background: 'linear-gradient(135deg, #2d6a4f 0%, #1b4332 100%)',
          },
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: '12px',
          boxShadow: '0px 6px 18px rgba(0, 0, 0, 0.03)',
          border: '1px solid rgba(226, 232, 240, 0.8)',
          backgroundColor: '#ffffff',
          transition: 'transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out',
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: '#ffffff',
          color: '#1e293b',
          boxShadow: '0px 2px 10px rgba(0, 0, 0, 0.02)',
          borderBottom: '1px solid rgba(226, 232, 240, 0.8)',
        },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-input': {
            color: '#000000',
            fontWeight: 500,
          },
          '& input::placeholder': {
            color: 'rgba(0, 0, 0, 0.50)',
            opacity: 1,
          },
          '& textarea::placeholder': {
            color: 'rgba(0, 0, 0, 0.50)',
            opacity: 1,
          },
        },
      },
    },
    MuiInputLabel: {
      styleOverrides: {
        root: {
          color: 'rgba(0, 0, 0, 0.50)',
          '&.Mui-focused': {
            color: '#1b4332',
          },
        },
      },
    },
  },
});

export default theme;
