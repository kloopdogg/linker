import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Box,
  Typography,
  Button,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Switch,
  FormControlLabel,
  Grid,
  Pagination,
  InputAdornment,
  Menu,
  MenuItem,
  Tooltip,
  CircularProgress,
  Alert,
} from '@mui/material';
import {
  Add,
  Edit,
  Delete,
  QrCode,
  QrCode2,
  ContentCopy,
  MoreVert,
  Search,
  Visibility,
  Download,
} from '@mui/icons-material';
import QRCode from 'react-qr-code';
import { urlAPI } from '../utils/api';
import toast from 'react-hot-toast';
import UrlAnalyticsDialog from '../components/UrlAnalyticsDialog';

const DEFAULT_SHORT_BASE_URL = process.env.REACT_APP_BACKEND_URL;

const buildShortUrl = (url) => {
  if (!url) {
    return DEFAULT_SHORT_BASE_URL;
  }

  return url.shortUrl || `${DEFAULT_SHORT_BASE_URL}/${url.shortCode}`;
};

const buildQrFilename = (url) => {
  const fallbackName = 'qr-code';
  const title = url?.title?.trim() || fallbackName;
  const safeTitle = title.toLowerCase().replace(/[^a-z0-9-_]+/g, '-');
  const baseName = safeTitle || fallbackName;
  return `${baseName}.png`;
};

const UrlManager = () => {
  const [urls, setUrls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [selectedUrl, setSelectedUrl] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [qrDialogOpen, setQrDialogOpen] = useState(false);
  const [analyticsDialogOpen, setAnalyticsDialogOpen] = useState(false);
  const [analyticsUrl, setAnalyticsUrl] = useState(null);
  const [menuAnchor, setMenuAnchor] = useState(null);
  const [formData, setFormData] = useState({
    title: '',
    originalUrl: '',
    description: '',
    isActive: true,
    tags: []
  });
  const qrCodeContainerRef = useRef(null);
  const qrSvgRefs = useRef(new Map());

  const fetchUrls = useCallback(async () => {
    try {
      setLoading(true);
      const params = {
        page,
        limit: 10,
        search: search || undefined
      };
      const response = await urlAPI.getUrls(params);
      setUrls(response.data.data.urls);
      setTotalPages(response.data.data.pagination.pages);
    } catch (error) {
      console.error('Failed to fetch URLs:', error);
      toast.error('Failed to load URLs');
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => {
    fetchUrls();
  }, [fetchUrls]);

  const handleCreateUrl = () => {
    setSelectedUrl(null);
    setFormData({
      title: '',
      originalUrl: '',
      description: '',
      isActive: true,
      tags: []
    });
    setDialogOpen(true);
  };

  const handleEditUrl = (url) => {
    setSelectedUrl(url);
    setFormData({
      title: url.title,
      originalUrl: url.originalUrl,
      description: url.description || '',
      isActive: url.isActive,
      tags: url.tags || []
    });
    setDialogOpen(true);
    setMenuAnchor(null);
  };

  const handleDeleteUrl = async (urlId) => {
    if (window.confirm('Are you sure you want to delete this URL?')) {
      try {
        await urlAPI.deleteUrl(urlId);
        toast.success('URL deleted successfully');
        fetchUrls();
      } catch (error) {
        toast.error('Failed to delete URL');
      }
    }
    setMenuAnchor(null);
  };

  const handleSubmit = async () => {
    try {
      if (selectedUrl) {
        await urlAPI.updateUrl(selectedUrl._id, formData);
        toast.success('URL updated successfully');
      } else {
        await urlAPI.createUrl(formData);
        toast.success('URL created successfully');
      }
      setDialogOpen(false);
      fetchUrls();
    } catch (error) {
      toast.error(`Failed to ${selectedUrl ? 'update' : 'create'} URL`);
    }
  };

  const handleCopyUrl = (shortUrl) => {
    navigator.clipboard.writeText(shortUrl);
    toast.success('URL copied to clipboard');
  };

  const handleShowQR = (url) => {
    setSelectedUrl(url);
    setQrDialogOpen(true);
    setMenuAnchor(null);
  };

  const handleShowAnalytics = (url) => {
    if (!url || !url._id) {
      toast.error('Could not open analytics for this URL');
      setMenuAnchor(null);
      return;
    }

    setAnalyticsUrl(url);
    setAnalyticsDialogOpen(true);
    setMenuAnchor(null);
  };

  const convertSvgToPngBlob = useCallback(async (svgElement) => {
    const serializer = new XMLSerializer();
    const svgString = serializer.serializeToString(svgElement);
    const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
    const svgUrl = URL.createObjectURL(svgBlob);

    try {
      const { width: rawWidth, height: rawHeight } = svgElement.getBoundingClientRect();
      const widthAttr = parseInt(svgElement.getAttribute('width') || '0', 10);
      const heightAttr = parseInt(svgElement.getAttribute('height') || '0', 10);
      const width = Math.ceil(rawWidth || widthAttr || 200);
      const height = Math.ceil(rawHeight || heightAttr || 200);

      const image = new Image();
      image.crossOrigin = 'anonymous';

      const pngBlob = await new Promise((resolve, reject) => {
        image.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const context = canvas.getContext('2d');

          if (!context) {
            reject(new Error('Canvas context unavailable'));
            return;
          }

          context.fillStyle = '#ffffff';
          context.fillRect(0, 0, width, height);
          context.drawImage(image, 0, 0, width, height);

          canvas.toBlob((blob) => {
            if (blob) {
              resolve(blob);
            } else {
              reject(new Error('Failed to export QR code'));
            }
          }, 'image/png');
        };

        image.onerror = () => reject(new Error('Unable to render QR code'));
        image.src = svgUrl;
      });

      return pngBlob;
    } finally {
      URL.revokeObjectURL(svgUrl);
    }
  }, []);

  const registerQrContainer = useCallback(
    (urlId) => (node) => {
      if (node) {
        qrSvgRefs.current.set(urlId, node);
      } else {
        qrSvgRefs.current.delete(urlId);
      }
    },
    []
  );

  const copySvgToClipboard = useCallback(async (svgElement) => {
    if (!svgElement) {
      toast.error('QR code is still loading');
      return false;
    }

    const clipboardItemCtor = typeof window !== 'undefined' ? window.ClipboardItem : undefined;

    if (typeof navigator.clipboard === 'undefined' || typeof navigator.clipboard.write === 'undefined' || !clipboardItemCtor) {
      toast.error('Copying images is not supported in this browser');
      return false;
    }

    try {
      const pngBlob = await convertSvgToPngBlob(svgElement);
      await navigator.clipboard.write([new clipboardItemCtor({ 'image/png': pngBlob })]);
      toast.success('QR code copied to clipboard');
      return true;
    } catch (error) {
      console.error('Failed to copy QR code image', error);
      toast.error('Could not copy QR code image');
      return false;
    }
  }, [convertSvgToPngBlob]);

  const downloadSvgAsPng = useCallback(async (svgElement, filename) => {
    if (!svgElement) {
      toast.error('QR code is still loading');
      return false;
    }

    try {
      const pngBlob = await convertSvgToPngBlob(svgElement);
      const downloadUrl = URL.createObjectURL(pngBlob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(downloadUrl);
      toast.success('QR code downloaded');
      return true;
    } catch (error) {
      console.error('Failed to download QR code', error);
      toast.error('Could not download QR code');
      return false;
    }
  }, [convertSvgToPngBlob]);

  const getRowQrSvg = (urlId) => {
    const container = qrSvgRefs.current.get(urlId);
    return container?.querySelector('svg') || null;
  };

  const handleCopyQrImage = useCallback(async () => {
    const svgElement = qrCodeContainerRef.current?.querySelector('svg');
    await copySvgToClipboard(svgElement);
  }, [copySvgToClipboard]);

  const handleCopyQrForUrl = useCallback(async (url) => {
    const svgElement = getRowQrSvg(url._id);
    await copySvgToClipboard(svgElement);
  }, [copySvgToClipboard]);

  const handleDownloadQrImage = useCallback(async () => {
    const svgElement = qrCodeContainerRef.current?.querySelector('svg');
    if (!selectedUrl) {
      toast.error('QR code is not available');
      return;
    }

    await downloadSvgAsPng(svgElement, buildQrFilename(selectedUrl));
  }, [downloadSvgAsPng, selectedUrl]);

  const handleDownloadQrForUrl = useCallback(async (url) => {
    const svgElement = getRowQrSvg(url._id);
    await downloadSvgAsPng(svgElement, buildQrFilename(url));
  }, [downloadSvgAsPng]);

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" component="h1">
          URL Manager
        </Typography>
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={handleCreateUrl}
        >
          Create Short URL
        </Button>
      </Box>

      <Paper sx={{ mb: 3, p: 2 }}>
        <TextField
          placeholder="Search URLs..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          fullWidth
          size="small"
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Search />
              </InputAdornment>
            ),
          }}
        />
      </Paper>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Title</TableCell>
              <TableCell>Description</TableCell>
              <TableCell sx={{ pl: 3.5 }}>Short URL</TableCell>
              <TableCell>Original URL</TableCell>
              <TableCell>Status</TableCell>
              <TableCell align="center">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} align="center">
                  <CircularProgress />
                </TableCell>
              </TableRow>
            ) : urls.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} align="center">
                  <Alert severity="info">No URLs found. Create your first short URL!</Alert>
                </TableCell>
              </TableRow>
            ) : (
              urls.map((url) => {
                const fullShortUrl = buildShortUrl(url);

                return (
                  <TableRow key={url._id}>
                    <TableCell>
                      <Typography variant="subtitle2">{url.title}</Typography>
                    </TableCell>
                    <TableCell>
                      <Typography
                        variant="body2"
                        color="textSecondary"
                        sx={{ maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis' }}
                      >
                        {url.description || '—'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Box display="flex" alignItems="center" gap={1}>
                        <Tooltip title="Copy URL">
                          <IconButton
                            size="small"
                            onClick={() => handleCopyUrl(fullShortUrl)}
                          >
                            <ContentCopy fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Copy QR code">
                          <IconButton
                            size="small"
                            onClick={() => handleCopyQrForUrl(url)}
                          >
                            <QrCode2 fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Download QR code">
                          <IconButton
                            size="small"
                            onClick={() => handleDownloadQrForUrl(url)}
                          >
                            <Download fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Box>
                      <Box
                        ref={registerQrContainer(url._id)}
                        sx={{ display: 'none' }}
                        aria-hidden
                      >
                        <QRCode value={fullShortUrl} size={200} />
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {url.originalUrl}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={url.isActive ? 'Active' : 'Inactive'}
                        color={url.isActive ? 'success' : 'default'}
                        size="small"
                      />
                    </TableCell>
                    <TableCell align="center">
                      <IconButton
                        onClick={(e) => setMenuAnchor(e.currentTarget)}
                        data-url={JSON.stringify(url)}
                      >
                        <MoreVert />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {totalPages > 1 && (
        <Box display="flex" justifyContent="center" mt={3}>
          <Pagination
            count={totalPages}
            page={page}
            onChange={(e, newPage) => setPage(newPage)}
            color="primary"
          />
        </Box>
      )}

      {/* Action Menu */}
      <Menu
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={() => setMenuAnchor(null)}
      >
        <MenuItem
          onClick={() => {
            const url = JSON.parse(menuAnchor?.dataset?.url || '{}');
            handleEditUrl(url);
          }}
        >
          <Edit fontSize="small" sx={{ mr: 1 }} />
          Edit
        </MenuItem>
        <MenuItem
          onClick={() => {
            const url = JSON.parse(menuAnchor?.dataset?.url || '{}');
            handleShowQR(url);
          }}
        >
          <QrCode fontSize="small" sx={{ mr: 1 }} />
          QR Code
        </MenuItem>
        <MenuItem
          onClick={() => {
            const url = JSON.parse(menuAnchor?.dataset?.url || '{}');
            handleShowAnalytics(url);
          }}
        >
          <Visibility fontSize="small" sx={{ mr: 1 }} />
          Analytics
        </MenuItem>
        <MenuItem
          onClick={() => {
            const url = JSON.parse(menuAnchor?.dataset?.url || '{}');
            handleDeleteUrl(url._id);
          }}
          sx={{ color: 'error.main' }}
        >
          <Delete fontSize="small" sx={{ mr: 1 }} />
          Delete
        </MenuItem>
      </Menu>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          {selectedUrl ? 'Edit URL' : 'Create Short URL'}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <TextField
                label="Title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                fullWidth
                required
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                label="Original URL"
                value={formData.originalUrl}
                onChange={(e) => setFormData({ ...formData, originalUrl: e.target.value })}
                fullWidth
                required
                placeholder="https://example.com"
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                label="Description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                fullWidth
                multiline
                rows={2}
              />
            </Grid>
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={formData.isActive}
                    onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  />
                }
                label="Active"
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleSubmit} variant="contained">
            {selectedUrl ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* QR Code Dialog */}
      <Dialog open={qrDialogOpen} onClose={() => setQrDialogOpen(false)}>
        <DialogTitle>QR Code</DialogTitle>
        <DialogContent>
          {selectedUrl && (
            <Box ref={qrCodeContainerRef} display="flex" flexDirection="column" alignItems="center" gap={2}>
              <Box
                onClick={handleCopyQrImage}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    handleCopyQrImage();
                  }
                }}
                role="button"
                tabIndex={0}
                aria-label="Copy QR code image"
                sx={(theme) => ({
                  cursor: 'pointer',
                  p: 1,
                  borderRadius: 1,
                  transition: 'background-color 0.2s',
                  '&:hover': { backgroundColor: theme.palette.action.hover },
                  '&:focus-visible': {
                    outline: `2px solid ${theme.palette.primary.main}`,
                    outlineOffset: 2
                  }
                })}
              >
                <QRCode
                    value={buildShortUrl(selectedUrl)}
                  size={200}
                />
              </Box>
              <Typography variant="caption" align="center" color="textSecondary">
                Click the QR code to copy the image.
              </Typography>
              <Typography variant="body2" align="center">
                {selectedUrl.title}
              </Typography>
              <Typography variant="caption" align="center" color="textSecondary">
                {buildShortUrl(selectedUrl)}
              </Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleDownloadQrImage} disabled={!selectedUrl}>
            Download
          </Button>
          <Button onClick={() => setQrDialogOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      <UrlAnalyticsDialog
        open={analyticsDialogOpen}
        url={analyticsUrl}
        onClose={() => {
          setAnalyticsDialogOpen(false);
          setAnalyticsUrl(null);
        }}
      />
    </Box>
  );
};

export default UrlManager;