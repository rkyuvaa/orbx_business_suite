import React, { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, useLocation } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { Box, Button, Typography, Alert, CircularProgress } from '@mui/material';

import { loginUser, clearAuthError } from '../app/slices/authSlice';
import FormInput from '../components/FormInput';

const schema = yup.object().shape({
  email: yup.string().email('Please enter a valid email address').required('Email is required'),
  password: yup.string().min(6, 'Password must be at least 6 characters').required('Password is required'),
});

const Login = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const { loading, error } = useSelector((state) => state.auth);

  const { control, handleSubmit } = useForm({
    resolver: yupResolver(schema),
  });

  const from = location.state?.from?.pathname || '/';

  const onSubmit = async (data) => {
    dispatch(clearAuthError());
    const result = await dispatch(loginUser(data));
    if (result.type === 'auth/loginUser/fulfilled') {
      navigate(from, { replace: true });
    }
  };

  return (
    <Box sx={{ mt: 2 }}>
      <Typography variant="h5" sx={{ fontWeight: 700, mb: 3, color: '#1e293b' }}>
        Welcome Back
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 3, borderRadius: '8px', textAlign: 'left' }}>
          {error}
        </Alert>
      )}

      <form onSubmit={handleSubmit(onSubmit)}>
        <FormInput
          name="email"
          control={control}
          label="Email Address"
          type="email"
          autoComplete="email"
          autoFocus
        />

        <FormInput
          name="password"
          control={control}
          label="Password"
          type="password"
          autoComplete="current-password"
        />

        <Button
          type="submit"
          fullWidth
          variant="contained"
          size="large"
          disabled={loading}
          sx={{ mt: 2, py: 1.5, fontSize: '0.95rem' }}
        >
          {loading ? (
            <CircularProgress size={24} sx={{ color: '#ffffff' }} />
          ) : (
            'Sign In'
          )}
        </Button>
      </form>
    </Box>
  );
};

export default Login;
