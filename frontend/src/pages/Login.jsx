import { useState } from 'react';
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';
import {
  Alert,
  Box,
  Button,
  IconButton,
  InputAdornment,
  TextField,
  Typography,
} from '@mui/material';
import { keyframes } from '@mui/system';
import { useNavigate } from 'react-router-dom';
import useAuth from '../hooks/useAuth';
import arcadeBg from '../assets/arcade-bg.png';
import logo from '../assets/game-galaxy-logo.png';

const gameEnter = keyframes`
  0% {
    opacity: 0;
    transform: scale(0.5) translateY(40px);
  }
  55% {
    opacity: 1;
    transform: scale(1.12) translateY(-6px);
  }
  75% {
    transform: scale(0.96) translateY(2px);
  }
  100% {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
`;

const neonPulse = keyframes`
  0%, 100% {
    text-shadow:
      0 0 10px #00f5ff,
      0 0 25px #00f5ff,
      0 0 45px #ff00de,
      0 0 70px rgba(255, 0, 222, 0.4),
      0 2px 6px rgba(0, 0, 0, 0.9);
  }
  33% {
    text-shadow:
      0 0 10px #ff00de,
      0 0 25px #ff00de,
      0 0 45px #ffe600,
      0 0 70px rgba(255, 230, 0, 0.35),
      0 2px 6px rgba(0, 0, 0, 0.9);
  }
  66% {
    text-shadow:
      0 0 10px #ffe600,
      0 0 25px #ffe600,
      0 0 45px #00f5ff,
      0 0 70px rgba(0, 245, 255, 0.35),
      0 2px 6px rgba(0, 0, 0, 0.9);
  }
`;

const arcadeGlitch = keyframes`
  0%, 88%, 100% {
    transform: translate(0);
    filter: none;
  }
  90% {
    transform: translate(-4px, 2px) skewX(-2deg);
    filter: hue-rotate(90deg);
  }
  92% {
    transform: translate(4px, -2px) skewX(2deg);
    filter: hue-rotate(-90deg);
  }
  94% {
    transform: translate(-2px, 0);
    filter: none;
  }
`;

const coinBounce = keyframes`
  0%, 100% {
    transform: translateY(0) scale(1);
  }
  50% {
    transform: translateY(-6px) scale(1.04);
  }
`;

const Login = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login({ login: loginId, password });
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', md: '3fr 2fr' },
        minHeight: '100vh',
        bgcolor: '#fff',
      }}
    >
      <Box
        sx={{
          position: 'relative',
          minHeight: { xs: 240, md: '100vh' },
          backgroundImage: `url(${arcadeBg})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        <Box
          sx={{
            pt: { xs: 4, md: 6 },
            px: 2,
            opacity: 0,
            animation: `${gameEnter} 1s cubic-bezier(0.34, 1.56, 0.64, 1) forwards, ${coinBounce} 1.8s ease-in-out 1s infinite`,
          }}
        >
          <Typography
            variant="h4"
            sx={{
              color: '#fff',
              fontWeight: 800,
              textAlign: 'center',
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              animation: `${neonPulse} 2.5s ease-in-out infinite, ${arcadeGlitch} 4s linear infinite`,
            }}
          >
            Hi, Welcome back
          </Typography>
        </Box>
      </Box>

      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: '#fff',
          px: { xs: 3, sm: 6 },
          py: 4,
        }}
      >
        <Box sx={{ width: '100%', maxWidth: 400 }}>
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'center',
              mb: 2,
            }}
          >
            <Box
              component="img"
              src={logo}
              alt="Game Galaxy Plus"
              sx={{
                width: 100,
                height: 'auto',
              }}
            />
          </Box>

          <Typography
            variant="h5"
            component="h1"
            sx={{
              fontWeight: 700,
              color: '#18181b',
              mb: 3,
              textAlign: 'center',
            }}
          >
            Sign in to Arcade Booking
          </Typography>

          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          <Box component="form" onSubmit={handleSubmit}>
            <TextField
              fullWidth
              label="Email or Username"
              type="text"
              margin="normal"
              value={loginId}
              onChange={(e) => setLoginId(e.target.value)}
              placeholder="Enter email or username"
              required
              autoComplete="username"
            />

            <TextField
              fullWidth
              label="Password"
              type={showPassword ? 'text' : 'password'}
              margin="normal"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      onClick={() => setShowPassword((prev) => !prev)}
                      edge="end"
                    >
                      {showPassword ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />

            <Button
              fullWidth
              type="submit"
              variant="contained"
              disabled={loading}
              sx={{
                mt: 3,
                py: 1.5,
                bgcolor: '#18181b',
                color: '#fff',
                fontWeight: 700,
                fontSize: '1rem',
                textTransform: 'none',
                boxShadow: 'none',
                '&:hover': {
                  bgcolor: '#27272a',
                  boxShadow: 'none',
                },
              }}
            >
              {loading ? 'Logging in...' : 'Login'}
            </Button>
          </Box>
        </Box>
      </Box>
    </Box>
  );
};

export default Login;
