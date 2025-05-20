"use client";

import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  CircularProgress,
  Alert,
  Button,
  TextField,
  MenuItem,
} from '@mui/material';
import { Grid as MuiGrid } from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { format, subDays } from 'date-fns';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { toast } from "sonner";
import { useRouter } from 'next/navigation';

interface DetectionEvent {
  _id: string;
  created_at: string;
  object_type: string;
  confidence: number;
  person_count: number;
}

interface DailyStats {
  date: string;
  count: number;
}

interface DetectionStats {
  daily_stats: DailyStats[];
  total_detections: number;
  max_people_detected: number;
}

const DetectionHistory: React.FC = () => {
  const [events, setEvents] = useState<DetectionEvent[]>([]);
  const [stats, setStats] = useState<DetectionStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [startDate, setStartDate] = useState<Date>(() => {
    const date = new Date();
    date.setDate(date.getDate() - 7); // 7 days ago
    return date;
  });
  const [endDate, setEndDate] = useState<Date>(() => new Date());
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const router = useRouter();

  // Set initial lastUpdate after component mounts
  useEffect(() => {
    setLastUpdate(new Date());
  }, []);

  const fetchDetectionHistory = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const params = new URLSearchParams();
      params.append('start_date', startDate.toISOString());
      params.append('end_date', endDate.toISOString());
      params.append('limit', '100');
      params.append('offset', '0');

      console.log('Date range:', {
        start: startDate.toISOString(),
        end: endDate.toISOString()
      });
      console.log('Fetching detection history with params:', params.toString());
      
      const response = await fetch(`http://localhost:5000/api/detection/history?${params}`, {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (response.status === 401) {
        setError('Session expired. Please log in again.');
        router.push('/auth/login');
        return;
      }

      if (!response.ok) {
        throw new Error('Failed to fetch detection history');
      }

      const data = await response.json();
      console.log('Received detection history data:', {
        success: data.success,
        count: data.count,
        dataLength: data.data?.length,
        firstItem: data.data?.[0],
        lastItem: data.data?.[data.data?.length - 1]
      });
      
      if (data.success) {
        setEvents(data.data);
        setLastUpdate(new Date());
        console.log('Updated events and lastUpdate timestamp');
      } else {
        setError(data.error || 'Failed to fetch detection history');
      }
    } catch (error) {
      console.error('Error fetching history:', error);
      setError('Failed to fetch detection history');
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, router]);

  const fetchDetectionStats = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const params = new URLSearchParams();
      params.append('start_date', startDate.toISOString());
      params.append('end_date', endDate.toISOString());

      const response = await fetch(`http://localhost:5000/api/detection/history/stats?${params}`, {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (response.status === 401) {
        setError('Session expired. Please log in again.');
        router.push('/auth/login');
        return;
      }

      if (!response.ok) {
        throw new Error('Failed to fetch detection stats');
      }

      const data = await response.json();
      if (data.success) {
        setStats(data.data);
        setLastUpdate(new Date());
      } else {
        setError(data.error || 'Failed to fetch detection stats');
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
      setError('Failed to fetch detection stats');
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, router]);

  // Initial data fetch
  useEffect(() => {
    fetchDetectionHistory();
    fetchDetectionStats();
  }, [fetchDetectionHistory, fetchDetectionStats]);

  // Auto-refresh data every 30 seconds if enabled
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      fetchDetectionHistory();
      fetchDetectionStats();
    }, 30000); // 30 seconds

    return () => clearInterval(interval);
  }, [autoRefresh, fetchDetectionHistory, fetchDetectionStats]);

  const handleDateRangeChange = (days: number) => {
    const end = new Date();
    const start = new Date(end.getTime() - days * 24 * 60 * 60 * 1000);
    setStartDate(start);
    setEndDate(end);
  };

  const toggleAutoRefresh = () => {
    setAutoRefresh(!autoRefresh);
  };

  if (loading && events.length === 0) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box p={3}>
        <Alert severity="error">{error}</Alert>
      </Box>
    );
  }

  return (
    <Box p={3}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4">
          Detection History
        </Typography>
        <Box display="flex" alignItems="center" gap={2}>
          <Typography variant="body2" color="text.secondary">
            Last updated: {lastUpdate ? format(lastUpdate, 'HH:mm:ss') : '--:--:--'}
          </Typography>
          <Button
            variant="outlined"
            size="small"
            onClick={toggleAutoRefresh}
            color={autoRefresh ? "primary" : "inherit"}
          >
            {autoRefresh ? "Auto-refresh ON" : "Auto-refresh OFF"}
          </Button>
          <Button
            variant="outlined"
            size="small"
            onClick={() => {
              fetchDetectionHistory();
              fetchDetectionStats();
            }}
          >
            Refresh Now
          </Button>
        </Box>
      </Box>

      {/* Date Range Selection */}
      <Box mb={3} display="flex" gap={2} alignItems="center">
        <Button variant="outlined" onClick={() => handleDateRangeChange(7)}>Last 7 Days</Button>
        <Button variant="outlined" onClick={() => handleDateRangeChange(30)}>Last 30 Days</Button>
        <Button variant="outlined" onClick={() => handleDateRangeChange(90)}>Last 90 Days</Button>
        <LocalizationProvider dateAdapter={AdapterDateFns}>
          <DatePicker
            label="Start Date"
            value={startDate}
            onChange={(date) => date && setStartDate(date)}
          />
          <DatePicker
            label="End Date"
            value={endDate}
            onChange={(date) => date && setEndDate(date)}
          />
        </LocalizationProvider>
      </Box>

      {/* Stats Summary */}
      {stats && (
        <Box mb={3}>
          <Typography variant="h6" gutterBottom>
            Summary
          </Typography>
          <Box display="flex" gap={3}>
            <Paper sx={{ p: 2 }}>
              <Typography variant="subtitle1">Total Detections</Typography>
              <Typography variant="h4">{stats.total_detections}</Typography>
            </Paper>
            <Paper sx={{ p: 2 }}>
              <Typography variant="subtitle1">Max People Detected</Typography>
              <Typography variant="h4">{stats.max_people_detected}</Typography>
            </Paper>
          </Box>
        </Box>
      )}

      {/* Chart */}
      {stats && stats.daily_stats.length > 0 && (
        <Box mb={3}>
          <Typography variant="h6" gutterBottom>
            Detection Trends
          </Typography>
          <Paper sx={{ p: 2 }}>
            <LineChart width={800} height={300} data={stats.daily_stats}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="count" stroke="#8884d8" name="Detections" />
            </LineChart>
          </Paper>
        </Box>
      )}

      {/* Recent Detections Table */}
      <Typography variant="h6" gutterBottom>
        Recent Detections
      </Typography>
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Date</TableCell>
              <TableCell>Time</TableCell>
              <TableCell>Object Type</TableCell>
              <TableCell>Confidence</TableCell>
              <TableCell>People Count</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {events.map((event) => (
              <TableRow key={event._id}>
                <TableCell>{format(new Date(event.created_at), 'yyyy-MM-dd')}</TableCell>
                <TableCell>{format(new Date(event.created_at), 'HH:mm:ss')}</TableCell>
                <TableCell>{event.object_type}</TableCell>
                <TableCell>{(event.confidence * 100).toFixed(1)}%</TableCell>
                <TableCell>{event.person_count}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
};

export default DetectionHistory;
