import React, { useState, useEffect, useCallback } from 'react';
import {
  Grid,
  Paper,
  Typography,
  Box,
  Card,
  CardContent,
  IconButton,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  CircularProgress,
} from '@mui/material';
import {
  TrendingUp,
  Link as LinkIcon,
  Visibility,
  People,
  Refresh,
} from '@mui/icons-material';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { analyticsAPI } from '../utils/api';
import toast from 'react-hot-toast';

const Dashboard = () => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [period, setPeriod] = useState('last30days');
  const [analytics, setAnalytics] = useState({
    totalVisits: 0,
    uniqueVisitors: 0,
    topCountries: [],
    deviceBreakdown: [],
    dailyStats: []
  });

  const fetchAnalytics = useCallback(async () => {
    try {
      setLoading(true);
      const response = await analyticsAPI.getOverview({ period });
      console.log('Analytics response:', response.data);
      setAnalytics(response.data.data);
    } catch (error) {
      console.error('Failed to fetch analytics:', error);
      toast.error('Failed to load analytics data');
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchAnalytics();
    setRefreshing(false);
    toast.success('Data refreshed');
  };

  const StatCard = ({ title, value, icon, color = 'primary' }) => (
    <Card>
      <CardContent>
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Box>
            <Typography color="textSecondary" gutterBottom>
              {title}
            </Typography>
            <Typography variant="h4" component="div">
              {loading ? <CircularProgress size={24} /> : (value ?? 0).toLocaleString()}
            </Typography>
          </Box>
          <Box
            sx={{
              backgroundColor: `${color}.light`,
              borderRadius: '50%',
              p: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {icon}
          </Box>
        </Box>
      </CardContent>
    </Card>
  );

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" component="h1" gutterBottom>
          Dashboard
        </Typography>
        <Box display="flex" alignItems="center" gap={2}>
          <FormControl size="small" sx={{ minWidth: 140 }}>
            <InputLabel>Period</InputLabel>
            <Select
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              label="Period"
            >
              <MenuItem value="today">Today</MenuItem>
              <MenuItem value="yesterday">Yesterday</MenuItem>
              <MenuItem value="last7days">Last 7 days</MenuItem>
              <MenuItem value="last30days">Last 30 days</MenuItem>
              <MenuItem value="last90days">Last 90 days</MenuItem>
            </Select>
          </FormControl>
          <IconButton onClick={handleRefresh} disabled={refreshing}>
            <Refresh />
          </IconButton>
        </Box>
      </Box>

      <Grid container spacing={3}>
        {/* Stats Cards */}
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Total Visits"
            value={analytics.totalVisits ?? 0}
            icon={<TrendingUp />}
            color="primary"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Unique Visitors"
            value={analytics.uniqueVisitors ?? 0}
            icon={<People />}
            color="secondary"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Visit Rate"
            value={(analytics.totalVisits ?? 0) > 0 ? 
              Math.round(((analytics.uniqueVisitors ?? 0) / (analytics.totalVisits ?? 1)) * 100) : 0}
            icon={<Visibility />}
            color="info"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Active URLs"
            value={(analytics.totalVisits ?? 0) > 0 ? Math.ceil((analytics.totalVisits ?? 0) / 10) : 0}
            icon={<LinkIcon />}
            color="success"
          />
        </Grid>

        {/* Charts */}
        <Grid item xs={12} lg={8}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Visit Trends
            </Typography>
            {loading ? (
              <Box display="flex" justifyContent="center" p={4}>
                <CircularProgress />
              </Box>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={analytics.dailyStats}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="date" 
                    tickFormatter={(value) => new Date(value).toLocaleDateString()}
                  />
                  <YAxis />
                  <Tooltip 
                    labelFormatter={(value) => new Date(value).toLocaleDateString()}
                  />
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

        {/* Top Countries */}
        <Grid item xs={12} lg={4}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Top Countries
            </Typography>
            {loading ? (
              <Box display="flex" justifyContent="center" p={4}>
                <CircularProgress />
              </Box>
            ) : (
              <Box>
                {analytics.topCountries.slice(0, 5).map((country, index) => (
                  <Box
                    key={country.country}
                    display="flex"
                    justifyContent="space-between"
                    alignItems="center"
                    py={1}
                    borderBottom={index < 4 ? '1px solid #eee' : 'none'}
                  >
                    <Typography variant="body2">
                      {country.country}
                    </Typography>
                    <Typography variant="body2" fontWeight="bold">
                      {country.visits ?? 0}
                    </Typography>
                  </Box>
                ))}
                {(!analytics.topCountries || analytics.topCountries.length === 0) && (
                  <Typography variant="body2" color="textSecondary">
                    No data available
                  </Typography>
                )}
              </Box>
            )}
          </Paper>
        </Grid>

        {/* Device Breakdown */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Device Types
            </Typography>
            {loading ? (
              <Box display="flex" justifyContent="center" p={4}>
                <CircularProgress />
              </Box>
            ) : (
              <Box>
                {(analytics.deviceBreakdown || []).map((device, index) => (
                  <Box
                    key={device.device}
                    display="flex"
                    justifyContent="space-between"
                    alignItems="center"
                    py={2}
                    borderBottom={index < (analytics.deviceBreakdown?.length || 0) - 1 ? '1px solid #eee' : 'none'}
                  >
                    <Typography variant="body1" sx={{ textTransform: 'capitalize' }}>
                      {device.device}
                    </Typography>
                    <Box textAlign="right">
                      <Typography variant="body1" fontWeight="bold">
                        {device.visits ?? 0}
                      </Typography>
                      <Typography variant="body2" color="textSecondary">
                        {device.uniqueVisits ?? 0} unique
                      </Typography>
                    </Box>
                  </Box>
                ))}
                {(!analytics.deviceBreakdown || analytics.deviceBreakdown.length === 0) && (
                  <Typography variant="body2" color="textSecondary">
                    No data available
                  </Typography>
                )}
              </Box>
            )}
          </Paper>
        </Grid>

        {/* Recent Activity */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Quick Stats
            </Typography>
            <Box>
              <Box display="flex" justifyContent="space-between" py={1}>
                <Typography variant="body2">Total URLs Created</Typography>
                <Typography variant="body2" fontWeight="bold">
                  {loading ? '...' : Math.ceil((analytics.totalVisits ?? 0) / 15) || 0}
                </Typography>
              </Box>
              <Box display="flex" justifyContent="space-between" py={1}>
                <Typography variant="body2">Average Visits per URL</Typography>
                <Typography variant="body2" fontWeight="bold">
                  {loading ? '...' : Math.round((analytics.totalVisits ?? 0) / Math.max(1, Math.ceil((analytics.totalVisits ?? 0) / 15)))}
                </Typography>
              </Box>
              <Box display="flex" justifyContent="space-between" py={1}>
                <Typography variant="body2">Top Device</Typography>
                <Typography variant="body2" fontWeight="bold" sx={{ textTransform: 'capitalize' }}>
                  {loading ? '...' : analytics.deviceBreakdown?.[0]?.device || 'N/A'}
                </Typography>
              </Box>
              <Box display="flex" justifyContent="space-between" py={1}>
                <Typography variant="body2">Top Country</Typography>
                <Typography variant="body2" fontWeight="bold">
                  {loading ? '...' : analytics.topCountries?.[0]?.country || 'N/A'}
                </Typography>
              </Box>
            </Box>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};

export default Dashboard;