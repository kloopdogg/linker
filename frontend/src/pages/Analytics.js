import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Box,
  Typography,
  Grid,
  Paper,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  CircularProgress,
  Button,
} from '@mui/material';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { Download } from '@mui/icons-material';
import { useLocation } from 'react-router-dom';
import { analyticsAPI } from '../utils/api';
import toast from 'react-hot-toast';
import DeviceTypeChart from '../components/DeviceTypeChart';
import MobileDeviceChart from '../components/MobileDeviceChart';

const DAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const HOURS = Array.from({ length: 24 }, (_, i) => i);

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
    const type = device.type || device.device || device._id || 'Unknown';
    const visits = device.visits ?? 0;
    const percentage = totalVisits > 0 ? (visits / totalVisits) * 100 : 0;
    return {
      type,
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

const Analytics = () => {
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('last30days');
  const [analytics, setAnalytics] = useState({
    overview: {},
    countries: [],
    devices: { devices: [], browsers: [] },
    deviceTypes: [],
    mobileDevices: [],
    timePatterns: { hourlyPatterns: [], dailyPatterns: [] }
  });
  const [urlAnalytics, setUrlAnalytics] = useState(null);
  const location = useLocation();

  const urlId = useMemo(() => {
    const params = new URLSearchParams(location.search);
    const id = params.get('url');
    return id?.trim() ? id.trim() : null;
  }, [location.search]);

  const isUrlScoped = Boolean(urlId);

  const fetchAnalytics = useCallback(async () => {
    try {
      setLoading(true);

      if (isUrlScoped && urlId) {
        const response = await analyticsAPI.getUrlAnalytics(urlId, { period });
        setUrlAnalytics(normalizeUrlAnalytics(response.data?.data));
      } else {
        const params = { period };
        const [overviewRes, countriesRes, devicesRes, deviceTypesRes, mobileDevicesRes, timePatternsRes] = await Promise.all([
          analyticsAPI.getOverview(params),
          analyticsAPI.getCountryAnalytics(params),
          analyticsAPI.getDeviceAnalytics(params),
          analyticsAPI.getDeviceTypeBreakdown(params),
          analyticsAPI.getMobileDeviceBreakdown(params),
          analyticsAPI.getTimePatterns(params)
        ]);

        setAnalytics({
          overview: overviewRes.data.data,
          countries: countriesRes.data.data,
          devices: devicesRes.data.data,
          deviceTypes: deviceTypesRes.data.data,
          mobileDevices: mobileDevicesRes.data.data,
          timePatterns: timePatternsRes.data.data
        });
        setUrlAnalytics(null);
      }
    } catch (error) {
      console.error('Failed to fetch analytics:', error);
      toast.error(isUrlScoped ? 'Failed to load analytics for this URL' : 'Failed to load analytics data');
      if (isUrlScoped) {
        setUrlAnalytics(null);
      }
    } finally {
      setLoading(false);
    }
  }, [isUrlScoped, urlId, period]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  const headerLabel = isUrlScoped
    ? `Analytics - ${urlAnalytics?.url?.title || 'URL'}`
    : 'Analytics - All';

  const handleExport = async (type = 'overview', format = 'json') => {
    if (isUrlScoped) {
      toast.error('Export is only available for overall analytics');
      return;
    }

    try {
      const params = { period, type, format };
      const response = await analyticsAPI.exportData(params);
      
      // Create download link
      const blob = new Blob([JSON.stringify(response.data, null, 2)], {
        type: format === 'csv' ? 'text/csv' : 'application/json'
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `analytics-${type}-${new Date().toISOString().split('T')[0]}.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      
      toast.success('Analytics data exported successfully');
    } catch (error) {
      toast.error('Failed to export data');
    }
  };

  const { heatmapCells, heatmapMax } = useMemo(() => {
    if (isUrlScoped) {
      return { heatmapCells: [], heatmapMax: 1 };
    }

    const hourlyPatterns = analytics.timePatterns?.hourlyPatterns || [];
    const dailyPatterns = analytics.timePatterns?.dailyPatterns || [];

    const cells = [];

    DAYS_SHORT.forEach((day, dayIndex) => {
      HOURS.forEach((hour) => {
        const dayPattern = dailyPatterns.find((pattern) => pattern.day === dayIndex);
        const hourPattern = hourlyPatterns.find((pattern) => pattern.hour === hour);
        const intensity = ((dayPattern?.visits || 0) + (hourPattern?.visits || 0)) / 2;

        cells.push({
          day,
          dayIndex,
          hour,
          intensity,
          visits: intensity
        });
      });
    });

    const maxIntensity = cells.reduce((max, cell) => Math.max(max, cell.intensity), 0) || 1;

    return { heatmapCells: cells, heatmapMax: maxIntensity };
  }, [isUrlScoped, analytics.timePatterns]);

  const countryRows = useMemo(() => {
    if (isUrlScoped) {
      return urlAnalytics?.countries || [];
    }
    return analytics.countries || [];
  }, [isUrlScoped, urlAnalytics, analytics.countries]);

  const displayedCountries = useMemo(() => {
    if (isUrlScoped) {
      return countryRows;
    }
    return countryRows.slice(0, 5);
  }, [isUrlScoped, countryRows]);

  const showCountriesExport = !isUrlScoped && countryRows.length > 5;

  const trendData = useMemo(() => {
    if (isUrlScoped) {
      return urlAnalytics?.timeline || [];
    }
    return analytics.overview?.dailyStats || [];
  }, [isUrlScoped, urlAnalytics, analytics.overview]);

  const statsCards = useMemo(() => {
    if (isUrlScoped) {
      return [
        {
          key: 'totalVisits',
          value: urlAnalytics?.stats?.totalVisits ?? 0,
          label: 'Total Scans',
          color: 'primary'
        },
        {
          key: 'uniqueVisits',
          value: urlAnalytics?.stats?.uniqueVisits ?? 0,
          label: 'Unique Users',
          color: 'secondary'
        }
      ];
    }

    return [
      {
        key: 'totalVisits',
        value: analytics.overview?.totalVisits ?? 0,
        label: 'Total Scans',
        color: 'primary',
        helper: '+1% than previous period'
      },
      {
        key: 'uniqueVisitors',
        value: analytics.overview?.uniqueVisitors ?? 0,
        label: 'Unique Users',
        color: 'secondary',
        helper: '+0% than previous period'
      }
    ];
  }, [isUrlScoped, urlAnalytics, analytics.overview]);

  const HeatmapCell = ({ data, maxIntensity }) => {
    const opacity = maxIntensity > 0 ? data.intensity / maxIntensity : 0;
    return (
      <div
        style={{
          width: 20,
          height: 20,
          backgroundColor: `rgba(102, 126, 234, ${opacity})`,
          border: '1px solid #eee',
          display: 'inline-block',
          margin: 1
        }}
        title={`${data.day} ${data.hour}:00 - ${Math.round(data.visits)} visits`}
      />
    );
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" component="h1">
          {headerLabel}
        </Typography>
        <Box display="flex" gap={2}>
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
          {!isUrlScoped && (
            <Button
              variant="outlined"
              startIcon={<Download />}
              onClick={() => handleExport('overview', 'json')}
            >
              Export Data
            </Button>
          )}
        </Box>
      </Box>

      <Grid container spacing={3}>
        {statsCards.map((card) => (
          <Grid item xs={12} md={6} lg={3} key={card.key}>
            <Paper sx={{ p: 3, textAlign: 'center' }}>
              <Typography variant="h3" color={card.color}>
                {card.value.toLocaleString()}
              </Typography>
              <Typography variant="subtitle1" color="textSecondary">
                {card.label}
              </Typography>
              {card.helper && (
                <Typography variant="body2" color="success.main">
                  {card.helper}
                </Typography>
              )}
            </Paper>
          </Grid>
        ))}

        {/* Countries Table */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Scans by Country
            </Typography>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Country</TableCell>
                    <TableCell align="right">Scans</TableCell>
                    <TableCell align="right">% of scans</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {displayedCountries.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} align="center">
                        <Typography variant="body2" color="textSecondary">
                          No country data available for this period.
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    displayedCountries.map((country) => (
                      <TableRow key={country.country}>
                        <TableCell>{country.country}</TableCell>
                        <TableCell align="right">{country.visits}</TableCell>
                        <TableCell align="right">{formatPercentage(country.percentage)}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
            {showCountriesExport && (
              <Box mt={1} textAlign="center">
                <Button size="small" onClick={() => handleExport('countries', 'csv')}>
                  Export Full Data
                </Button>
              </Box>
            )}
          </Paper>
        </Grid>

        {/* Device Type Breakdown */}
        {!isUrlScoped && (
          <Grid item xs={12} md={6}>
            <DeviceTypeChart 
              deviceData={analytics.deviceTypes} 
              title="Visits by Device Type"
              showAsCard={true}
            />
          </Grid>
        )}

        {/* URL-scoped Device Type */}
        {isUrlScoped && urlAnalytics?.devices && (
          <Grid item xs={12} md={6}>
            <DeviceTypeChart 
              deviceData={urlAnalytics.devices} 
              title="Visits by Device Type"
              showAsCard={true}
            />
          </Grid>
        )}

        {/* Mobile Devices Breakdown */}
        {!isUrlScoped && (
          <Grid item xs={12} md={6}>
            <MobileDeviceChart 
              mobileDeviceData={analytics.mobileDevices} 
              title="Visits by Mobile Device"
              showAsCard={true}
            />
          </Grid>
        )}

        {/* Time Heatmap */}
        {!isUrlScoped && (
          <Grid item xs={12}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                Scans by Time of Day
              </Typography>
              {heatmapCells.length === 0 ? (
                <Typography variant="body2" color="textSecondary">
                  No time pattern data available for this period.
                </Typography>
              ) : (
                <Box sx={{ overflowX: 'auto', p: 2 }}>
                  <Typography variant="caption" color="textSecondary" gutterBottom>
                    Hours (0-23) vs Days of Week
                  </Typography>
                  <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(24, 1fr)', gap: 0.5, mt: 2 }}>
                    {HOURS.map((hour) => (
                      <Typography key={`hour-label-${hour}`} variant="caption" sx={{ textAlign: 'center', fontSize: '10px' }}>
                        {hour}
                      </Typography>
                    ))}
                    {heatmapCells.map((cell, index) => (
                      <HeatmapCell key={`heatmap-cell-${cell.day}-${cell.hour}-${index}`} data={cell} maxIntensity={heatmapMax} />
                    ))}
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-around', mt: 2 }}>
                    {DAYS_SHORT.map((day) => (
                      <Typography key={`day-label-${day}`} variant="caption">
                        {day}
                      </Typography>
                    ))}
                  </Box>
                </Box>
              )}
            </Paper>
          </Grid>
        )}

        {/* Hourly Pattern Chart */}
        {!isUrlScoped && (
          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                Hourly Pattern
              </Typography>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={analytics.timePatterns.hourlyPatterns}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="hour" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="visits" fill="#667eea" />
                </BarChart>
              </ResponsiveContainer>
            </Paper>
          </Grid>
        )}

        {/* Daily Pattern Chart */}
        {!isUrlScoped && (
          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                Daily Pattern
              </Typography>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={analytics.timePatterns.dailyPatterns}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="dayName" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="visits" fill="#764ba2" />
                </BarChart>
              </ResponsiveContainer>
            </Paper>
          </Grid>
        )}

        {/* Trend Chart */}
        <Grid item xs={12}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Click Trends Over Time
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
    </Box>
  );
};

export default Analytics;