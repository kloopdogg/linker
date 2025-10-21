import React from 'react';
import {
  Box,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableRow,
  Paper
} from '@mui/material';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip
} from 'recharts';

const COLORS = ['#667eea', '#764ba2', '#f093fb', '#f5576c', '#4facfe', '#00f2fe'];

const formatPercentage = (value) => {
  const numeric = typeof value === 'string' ? parseFloat(value) : value;
  if (!Number.isFinite(numeric)) {
    return '0.00%';
  }
  return `${numeric.toFixed(2)}%`;
};

function MobileDeviceChart({ mobileDeviceData = [], title = 'Scans by Mobile Device', showAsCard = false }) {
  const content = (
    <>
      <Typography variant="h6" gutterBottom>
        {title}
      </Typography>
      {mobileDeviceData.length === 0 ? (
        <Typography variant="body2" color="textSecondary">
          No mobile device data available for this period.
        </Typography>
      ) : (
        <>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie
                data={mobileDeviceData}
                cx="50%"
                cy="50%"
                outerRadius={80}
                dataKey="visits"
                nameKey="brand"
                label={({ brand, percentage }) => `${brand}: ${formatPercentage(percentage)}`}
              >
                {mobileDeviceData.map((entry, index) => (
                  <Cell key={`mobile-device-${entry.brand}-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(value) => value.toLocaleString()} />
            </PieChart>
          </ResponsiveContainer>
          <Box mt={2}>
            <Table size="small">
              <TableBody>
                {mobileDeviceData.map((device, index) => (
                  <TableRow key={`mobile-device-row-${device.brand}-${index}`}>
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
                        {device.brand}
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
    </>
  );

  if (showAsCard) {
    return <Paper sx={{ p: 3 }}>{content}</Paper>;
  }

  return content;
}

export default MobileDeviceChart;
