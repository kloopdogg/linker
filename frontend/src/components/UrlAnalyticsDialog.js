import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Typography,
  Box,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  CircularProgress,
  Button,
  Grid,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { analyticsAPI } from '../utils/api';
import toast from 'react-hot-toast';

const COLORS = ['#667eea', '#764ba2', '#f093fb', '#f5576c', '#4facfe', '#00f2fe'];

const PERIOD_OPTIONS = [
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'last7days', label: 'Last 7 days' },
  { value: 'last30days', label: 'Last 30 days' },
  { value: 'last90days', label: 'Last 90 days' }
];

const formatPercentage = (value) => {
  const numeric = typeof value === 'string' ? parseFloat(value) : value;
  if (!Number.isFinite(numeric)) {
    return '0.00%';
  }
  return `${numeric.toFixed(2)}%`;
};

const normalizeUrlAnalytics = (rawData) => {
  if (!rawData) {
    return null;
  }

  const totalVisits = rawData.stats?.totalVisits ?? 0;

  const countries = (rawData.countries || []).map((country) => {
    const name = country.country || country._id || 'Unknown';
    const visits = country.visits ?? 0;
    const percentage = totalVisits > 0 ? (visits / totalVisits) * 100 : 0;
    return {
      country: name,
      visits,
      uniqueVisits: country.uniqueVisits ?? 0,
      percentage
    };
  });

  const devices = (rawData.devices || []).map((device) => {
    const deviceName = device.type || device.device || device._id || 'Unknown';
    const visits = device.visits ?? 0;
    const percentage = totalVisits > 0 ? (visits / totalVisits) * 100 : 0;
    return {
      type: deviceName,
      visits,
      uniqueVisits: device.uniqueVisits ?? 0,
      percentage
    };
  });

  const timeline = (rawData.timeline || [])
    .map((entry) => ({
      date: entry.date,
      visits: entry.visits ?? 0,
      uniqueVisits: entry.uniqueVisits ?? 0
    }))
    .sort((a, b) => new Date(a.date).valueOf() - new Date(b.date).valueOf());

  return {
    url: rawData.url,
    stats: {
      totalVisits,
      uniqueVisits: rawData.stats?.uniqueVisits ?? 0
    },
    countries,
    devices,
    timeline
  };
};

const UrlAnalyticsDialog = ({ open, url, onClose }) => {
  const [period, setPeriod] = useState('last30days');
  const [loading, setLoading] = useState(false);
  const [analytics, setAnalytics] = useState(null);

  const urlId = url?._id || url?.id;

  const loadAnalytics = useCallback(async () => {
    if (!open || !urlId) {
      return;
    }

    try {
      setLoading(true);
      const response = await analyticsAPI.getUrlAnalytics(urlId, { period });
      setAnalytics(normalizeUrlAnalytics(response.data?.data));
    } catch (error) {
      console.error('Failed to load URL analytics', error);
      toast.error('Failed to load analytics for this URL');
      setAnalytics(null);
    } finally {
      setLoading(false);
    }
  }, [open, urlId, period]);

  useEffect(() => {
    if (open) {
      loadAnalytics();
    }
  }, [open, loadAnalytics]);

  useEffect(() => {
    if (!open) {
      setAnalytics(null);
      setPeriod('last30days');
    }
  }, [open]);

  const countryRows = useMemo(() => analytics?.countries || [], [analytics]);
  const deviceData = useMemo(() => analytics?.devices || [], [analytics]);
  const trendData = useMemo(() => analytics?.timeline || [], [analytics]);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle sx={{ pr: 6 }}>
        {url?.title || analytics?.url?.title || 'URL Analytics'}
        <IconButton
          aria-label="close"
          onClick={onClose}
          sx={{
            position: 'absolute',
            right: 8,
            top: 8
          }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
          <Typography variant="subtitle1" color="textSecondary">
            Analytics for {url?.title || analytics?.url?.title || 'selected URL'}
          </Typography>
          <FormControl size="small" sx={{ minWidth: 140 }}>
            <InputLabel>Period</InputLabel>
            <Select
              value={period}
              label="Period"
              onChange={(event) => setPeriod(event.target.value)}
            >
              {PERIOD_OPTIONS.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>

        {loading ? (
          <Box display="flex" justifyContent="center" alignItems="center" minHeight="320px">
            <CircularProgress />
          </Box>
        ) : !analytics ? (
          <Typography variant="body2" color="textSecondary">
            No analytics data available for this URL.
          </Typography>
        ) : (
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Paper sx={{ p: 3, textAlign: 'center' }}>
                <Typography variant="h3" color="primary">
                  {(analytics.stats.totalVisits || 0).toLocaleString()
                  }
                </Typography>
                <Typography variant="subtitle1" color="textSecondary">
                  Total Visits
                </Typography>
              </Paper>
            </Grid>
            <Grid item xs={12} md={6}>
              <Paper sx={{ p: 3, textAlign: 'center' }}>
                <Typography variant="h3" color="secondary">
                  {(analytics.stats.uniqueVisits || 0).toLocaleString()
                  }
                </Typography>
                <Typography variant="subtitle1" color="textSecondary">
                  Unique Visitors
                </Typography>
              </Paper>
            </Grid>

            <Grid item xs={12} md={6}>
              <Paper sx={{ p: 3 }}>
                <Typography variant="h6" gutterBottom>
                  Visits by Device Type
                </Typography>
                {deviceData.length === 0 ? (
                  <Typography variant="body2" color="textSecondary">
                    No device data available for this period.
                  </Typography>
                ) : (
                  <>
                    <ResponsiveContainer width="100%" height={280}>
                      <PieChart>
                        <Pie
                          data={deviceData}
                          cx="50%"
                          cy="50%"
                          outerRadius={80}
                          dataKey="visits"
                          label={({ type, percentage }) => `${type}: ${formatPercentage(percentage)}`}
                        >
                          {deviceData.map((entry, index) => (
                            <Cell key={`device-${entry.type}-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value) => value.toLocaleString()} />
                      </PieChart>
                    </ResponsiveContainer>
                    <Box mt={2}>
                      <Table size="small">
                        <TableBody>
                          {deviceData.map((device, index) => (
                            <TableRow key={`device-row-${device.type}-${index}`}>
                              <TableCell>
                                <Box display="flex" alignItems="center" gap={1}>
                                  <Box
                                    sx={{
                                      width: 12,
                                      height: 12,
                                      borderRadius: '50%',
                                      backgroundColor: COLORS[index % COLORS.length]
                                    }}
                                  />
                                  {device.type}
                                </Box>
                              </TableCell>
                              <TableCell align="right">{device.visits}</TableCell>
                              <TableCell align="right">{formatPercentage(device.percentage)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </Box>
                  </>
                )}
              </Paper>
            </Grid>

            <Grid item xs={12} md={6}>
              <Paper sx={{ p: 3 }}>
                <Typography variant="h6" gutterBottom>
                  Visits by Country
                </Typography>
                {countryRows.length === 0 ? (
                  <Typography variant="body2" color="textSecondary">
                    No country data available for this period.
                  </Typography>
                ) : (
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Country</TableCell>
                          <TableCell align="right">Visits</TableCell>
                          <TableCell align="right">% of visits</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {countryRows.map((country) => (
                          <TableRow key={`country-row-${country.country}`}>
                            <TableCell>{country.country}</TableCell>
                            <TableCell align="right">{country.visits}</TableCell>
                            <TableCell align="right">{formatPercentage(country.percentage)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                )}
              </Paper>
            </Grid>

            <Grid item xs={12}>
              <Paper sx={{ p: 3 }}>
                <Typography variant="h6" gutterBottom>
                  Visit Trends Over Time
                </Typography>
                {trendData.length === 0 ? (
                  <Typography variant="body2" color="textSecondary">
                    No trend data available for this period.
                  </Typography>
                ) : (
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={trendData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis
                        dataKey="date"
                        tickFormatter={(value) => new Date(value).toLocaleDateString()}
                      />
                      <YAxis />
                      <Tooltip
                        labelFormatter={(value) => new Date(value).toLocaleDateString()}
                        formatter={(value) => value.toLocaleString()}
                      />
                      <Legend />
                      <Line
                        type="monotone"
                        dataKey="visits"
                        stroke="#667eea"
                        strokeWidth={2}
                        name="Total Visits"
                      />
                      <Line
                        type="monotone"
                        dataKey="uniqueVisits"
                        stroke="#764ba2"
                        strokeWidth={2}
                        name="Unique Visits"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </Paper>
            </Grid>
          </Grid>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
};

export default UrlAnalyticsDialog;
