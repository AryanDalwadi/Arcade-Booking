import { createTheme } from '@mui/material/styles';

const colors = {
  primary: '#18181b',
  secondary: '#27272a',
  background: '#fafafa',
  border: '#e4e4e7',
  paper: '#ffffff',
};

const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: colors.primary,
      contrastText: '#ffffff',
    },
    secondary: {
      main: colors.secondary,
      contrastText: '#ffffff',
    },
    background: {
      default: colors.background,
      paper: colors.paper,
    },
    divider: colors.border,
    text: {
      primary: colors.primary,
      secondary: '#52525b',
    },
  },
  typography: {
    fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
    h5: {
      fontWeight: 700,
      color: colors.primary,
    },
    h6: {
      fontWeight: 700,
      color: colors.primary,
    },
  },
  shape: {
    borderRadius: 12,
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          backgroundColor: colors.background,
        },
      },
    },
    MuiAppBar: {
      defaultProps: {
        elevation: 0,
        color: 'inherit',
      },
      styleOverrides: {
        root: {
          boxShadow: 'none',
          backgroundColor: colors.paper,
          borderBottom: `1px solid ${colors.border}`,
          color: colors.primary,
        },
      },
    },
    MuiPaper: {
      defaultProps: {
        elevation: 0,
      },
      styleOverrides: {
        root: {
          boxShadow: 'none',
          backgroundImage: 'none',
          backgroundColor: colors.paper,
          border: `1px solid ${colors.border}`,
        },
      },
    },
    MuiCard: {
      defaultProps: {
        elevation: 0,
      },
      styleOverrides: {
        root: {
          boxShadow: 'none',
          border: `1px solid ${colors.border}`,
          backgroundColor: colors.paper,
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 600,
          boxShadow: 'none',
          '&:hover': {
            boxShadow: 'none',
          },
        },
        contained: {
          boxShadow: 'none',
          '&:hover': {
            boxShadow: 'none',
          },
        },
        containedPrimary: {
          backgroundColor: colors.primary,
          '&:hover': {
            backgroundColor: colors.secondary,
          },
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          boxShadow: 'none',
          borderRight: `1px solid ${colors.border}`,
          backgroundColor: colors.paper,
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          boxShadow: 'none',
          border: `1px solid ${colors.border}`,
        },
      },
    },
  },
});

export default theme;
