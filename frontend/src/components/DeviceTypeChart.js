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

function DeviceTypeChart({ deviceData = [], title = 'Visits by Device Type', showAsCard = false }) {
  const content = (
    <>
      <Typography variant="h6" gutterBottom>
        {title}
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
                nameKey="type"
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
    </>
  );

  if (showAsCard) {
    return <Paper sx={{ p: 3 }}>{content}</Paper>;
  }

  return content;
}

export default DeviceTypeChart;
