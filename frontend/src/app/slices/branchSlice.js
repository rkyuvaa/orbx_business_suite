import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import apiClient from '../../api/client';

export const fetchBranches = createAsyncThunk(
  'branch/fetchBranches',
  async (_, { rejectWithValue }) => {
    try {
      const response = await apiClient.get('/admin/branches');
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.detail || 'Failed to fetch branch offices.');
    }
  }
);

const initialState = {
  branches: [],
  activeBranch: null,
  activeBranchId: localStorage.getItem('active_branch_id') || null,
  loading: false,
  error: null,
};

const branchSlice = createSlice({
  name: 'branch',
  initialState,
  reducers: {
    setActiveBranch(state, action) {
      const branch = action.payload;
      state.activeBranch = branch;
      state.activeBranchId = branch ? branch.id : null;
      if (branch) {
        localStorage.setItem('active_branch_id', branch.id);
      } else {
        localStorage.removeItem('active_branch_id');
      }
    },
    resetBranchContext(state) {
      state.branches = [];
      state.activeBranch = null;
      state.activeBranchId = null;
      localStorage.removeItem('active_branch_id');
    }
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchBranches.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchBranches.fulfilled, (state, action) => {
        state.loading = false;
        state.branches = action.payload;
        
        // Auto-select active branch if not set or invalid
        if (action.payload.length > 0) {
          const storedId = state.activeBranchId;
          const match = action.payload.find((b) => b.id === storedId);
          if (match) {
            state.activeBranch = match;
          } else {
            state.activeBranch = action.payload[0];
            state.activeBranchId = action.payload[0].id;
            localStorage.setItem('active_branch_id', action.payload[0].id);
          }
        }
      })
      .addCase(fetchBranches.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });
  },
});

export const { setActiveBranch, resetBranchContext } = branchSlice.actions;
export default branchSlice.reducer;
