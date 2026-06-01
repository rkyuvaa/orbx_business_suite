import React from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button,
  IconButton, Typography, Box
} from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';

const CommonModal = ({
  open,
  onClose,
  title,
  children,
  maxWidth = 'sm',
  actions
}) => {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth={maxWidth}
      PaperProps={{
        sx: {
          borderRadius: '12px',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.08)',
        }
      }}
    >
      <DialogTitle sx={{ m: 0, p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f1f5f9' }}>
        <Typography variant="h6" component="div" sx={{ fontWeight: 600 }}>
          {title}
        </Typography>
        <IconButton
          aria-label="close"
          onClick={onClose}
          sx={{
            color: (theme) => theme.palette.grey[500],
          }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      
      <DialogContent dividers sx={{ p: 3, borderTop: 'none', borderBottom: 'none' }}>
        <Box sx={{ mt: 1 }}>
          {children}
        </Box>
      </DialogContent>

      {actions && (
        <DialogActions sx={{ p: 2, borderTop: '1px solid #f1f5f9' }}>
          {actions}
        </DialogActions>
      )}
    </Dialog>
  );
};

export default CommonModal;
