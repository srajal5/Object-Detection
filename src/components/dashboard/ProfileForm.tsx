"use client";

import React, { useState, useEffect } from 'react';
import {
  Box,
  TextField,
  Button,
  Typography,
  Alert,
  CircularProgress,
} from '@mui/material';
import { toast } from "sonner";

interface UserProfile {
  name: string;
  email: string;
}

export default function ProfileForm() {
  const [profile, setProfile] = useState<UserProfile>({
    name: '',
    email: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(true);

  useEffect(() => {
    fetchProfile();
  }, []);

  useEffect(() => {
    console.log('isEditing state changed:', isEditing);
  }, [isEditing]);

  const fetchProfile = async () => {
    try {
      setLoading(true);
      const response = await fetch('http://localhost:5000/api/user/profile', {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch profile');
      }

      const data = await response.json();
      if (data.success) {
        setProfile(data.data);
      } else {
        setError(data.error || 'Failed to fetch profile');
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
      setError('Failed to fetch profile');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('http://localhost:5000/api/user/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(profile),
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to update profile');
      }

      if (data.success) {
        toast.success('Profile updated successfully');
      } else {
        setError(data.error || 'Failed to update profile');
      }
    } catch (error: any) {
      console.error('Error updating profile:', error);
      setError(error.message || 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setProfile(prev => ({
      ...prev,
      [name]: value
    }));
  };

  if (loading && !profile.name) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="200px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box component="form" onSubmit={handleSubmit} sx={{ maxWidth: 600 }}>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Box mb={3}>
        <Typography variant="h6" gutterBottom className="text-gray-900 dark:text-gray-100">
          Profile Information
        </Typography>
        <Typography variant="body2" color="text.secondary" className="dark:text-gray-400">
          Update your personal information
        </Typography>
      </Box>

      <Box mb={3}>
        <TextField
          fullWidth
          label="Name"
          name="name"
          value={profile.name}
          onChange={handleChange}
          className="dark:text-gray-300"
          sx={{
            '& .MuiInputLabel-root': {
              color: 'inherit',
            },
            '& .MuiOutlinedInput-root': {
              '& fieldset': {
                borderColor: 'inherit',
              },
              '&:hover fieldset': {
                borderColor: 'inherit',
              },
              '&.Mui-focused fieldset': {
                borderColor: 'inherit',
              },
              '& input': {
                color: 'inherit',
              },
            },
          }}
        />
      </Box>

      <Box mb={3}>
        <TextField
          fullWidth
          label="Email"
          name="email"
          type="email"
          value={profile.email}
          onChange={handleChange}
          className="dark:text-gray-300"
          sx={{
            '& .MuiInputLabel-root': {
              color: 'inherit',
            },
            '& .MuiOutlinedInput-root': {
              '& fieldset': {
                borderColor: 'inherit',
              },
              '&:hover fieldset': {
                borderColor: 'inherit',
              },
              '&.Mui-focused fieldset': {
                borderColor: 'inherit',
              },
              '& input': {
                color: 'inherit',
              },
            },
          }}
        />
      </Box>

      <Box display="flex" gap={2}>
        <Button
          type="submit"
          variant="contained"
          color="primary"
          disabled={loading}
        >
          {loading ? 'Saving...' : 'Save Changes'}
        </Button>
        <Button
          type="button"
          variant="outlined"
          onClick={() => fetchProfile()}
          disabled={loading}
          className="dark:border-gray-600 dark:text-gray-300"
        >
          Reset
        </Button>
      </Box>
    </Box>
  );
}
