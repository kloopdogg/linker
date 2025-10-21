import QRCode from 'qrcode';

export interface QRCodeOptions {
  size?: number;
  foregroundColor?: string;
  backgroundColor?: string;
  errorCorrectionLevel?: 'L' | 'M' | 'Q' | 'H';
  logo?: string;
}

export interface QRCodeCustomization {
  foregroundColor: string;
  backgroundColor: string;
  logo?: string;
}

export interface QRCodeResult {
  dataUrl: string;
  size: number;
  errorCorrectionLevel: 'L' | 'M' | 'Q' | 'H';
  customization: QRCodeCustomization;
}

class QRCodeService {
  static async generateQRCode(url: string, options: QRCodeOptions = {}): Promise<QRCodeResult> {
    try {
      const qrOptions = {
        width: options.size || 200,
        margin: 2,
        color: {
          dark: options.foregroundColor || '#000000',
          light: options.backgroundColor || '#FFFFFF'
        },
        errorCorrectionLevel: options.errorCorrectionLevel || 'M' as const
      };

      // Generate QR code as data URL
      const dataUrl = await QRCode.toDataURL(url, qrOptions);
      
      return {
        dataUrl,
        size: qrOptions.width,
        errorCorrectionLevel: qrOptions.errorCorrectionLevel,
        customization: {
          foregroundColor: qrOptions.color.dark,
          backgroundColor: qrOptions.color.light,
          ...(options.logo && { logo: options.logo })
        }
      };
    } catch (error) {
      throw new Error(`QR Code generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  static async generateCustomQRCode(url: string, customization: QRCodeOptions = {}): Promise<QRCodeResult> {
    const options: QRCodeOptions = {
      size: customization.size || 200,
      foregroundColor: customization.foregroundColor || '#000000',
      backgroundColor: customization.backgroundColor || '#FFFFFF',
      errorCorrectionLevel: customization.errorCorrectionLevel || 'M',
      ...(customization.logo && { logo: customization.logo })
    };

    return this.generateQRCode(url, options);
  }

  static validateCustomization(customization: QRCodeOptions): string[] {
    const errors: string[] = [];

    if (customization.size && (customization.size < 100 || customization.size > 1000)) {
      errors.push('Size must be between 100 and 1000 pixels');
    }

    if (customization.foregroundColor && !/^#[0-9A-F]{6}$/i.test(customization.foregroundColor)) {
      errors.push('Foreground color must be a valid hex color');
    }

    if (customization.backgroundColor && !/^#[0-9A-F]{6}$/i.test(customization.backgroundColor)) {
      errors.push('Background color must be a valid hex color');
    }

    if (customization.errorCorrectionLevel && !['L', 'M', 'Q', 'H'].includes(customization.errorCorrectionLevel)) {
      errors.push('Error correction level must be L, M, Q, or H');
    }

    return errors;
  }
}

export default QRCodeService;