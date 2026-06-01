import { configureStore } from '@reduxjs/toolkit';
import authReducer from './slices/authSlice';
import branchReducer from './slices/branchSlice';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    branch: branchReducer,
  },
  devTools: process.env.NODE_ENV !== 'production',
});

export default store;
