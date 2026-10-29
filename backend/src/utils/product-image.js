import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp'];

const storage = multer.diskStorage({
  destination(req, file, cb) {
    try {
      const companyId = String(req.params.companyId || 'common').replace(/[^a-zA-Z0-9_-]/g, '');
      const uploadDir = path.join(process.cwd(), 'uploads', 'tenants', companyId, 'products');
      fs.mkdirSync(uploadDir, { recursive: true });
      cb(null, uploadDir);
    } catch (err) {
      cb(err);
    }
  },
  filename(req, file, cb) {
    try {
      const ext = path.extname(file.originalname).toLowerCase();
      const safeExt = ALLOWED_EXTENSIONS.includes(ext) ? ext : '.jpg';
      const uniqueName = `prod-${Date.now()}-${crypto.randomBytes(8).toString('hex')}${safeExt}`;
      cb(null, uniqueName);
    } catch (err) {
      cb(err);
    }
  },
});

function fileFilter(req, file, cb) {
  if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    const error = new Error('Invalid file format. Only JPEG, PNG, and WebP images are supported.');
    error.statusCode = 400;
    return cb(error, false);
  }
  cb(null, true);
}

export const multerUpload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter,
});

/**
 * Validate file content using magic bytes to prevent spoofed MIME types
 */
export function validateImageMagicBytes(filePath) {
  if (!filePath || !fs.existsSync(filePath)) {
    const err = new Error('Uploaded file could not be found on server.');
    err.statusCode = 400;
    throw err;
  }

  const fd = fs.openSync(filePath, 'r');
  const buffer = Buffer.alloc(16);
  const bytesRead = fs.readSync(fd, buffer, 0, 16, 0);
  fs.closeSync(fd);

  if (bytesRead < 12) {
    try { fs.unlinkSync(filePath); } catch (_) {}
    const err = new Error('Invalid or corrupted image file.');
    err.statusCode = 400;
    throw err;
  }

  const isJpeg = buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF;
  const isPng = buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47;
  const isWebp =
    buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 &&
    buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50;

  if (!isJpeg && !isPng && !isWebp) {
    try { fs.unlinkSync(filePath); } catch (_) {}
    const err = new Error('Invalid image content. File must be a valid JPEG, PNG, or WebP image.');
    err.statusCode = 400;
    throw err;
  }

  let mimeType = 'image/jpeg';
  if (isPng) mimeType = 'image/png';
  if (isWebp) mimeType = 'image/webp';

  return mimeType;
}

/**
 * Safely delete an uploaded file from disk with path traversal guard
 */
export function deleteStoredImageFile(relativeOrFullPath) {
  if (!relativeOrFullPath || typeof relativeOrFullPath !== 'string') return;

  const normalized = relativeOrFullPath.startsWith('/') ? relativeOrFullPath.slice(1) : relativeOrFullPath;
  const fullPath = path.resolve(process.cwd(), normalized);
  const uploadsRoot = path.resolve(process.cwd(), 'uploads');

  // Guard against directory traversal
  if (!fullPath.startsWith(uploadsRoot)) {
    return;
  }

  try {
    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
    }
  } catch (err) {
    // Non-fatal logging
    console.error('Failed to delete image file:', fullPath, err.message);
  }
}

/**
 * Express middleware for single product image upload
 */
export function handleProductImageUpload(req, res, next) {
  multerUpload.single('image')(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          success: false,
          message: 'Image size exceeds maximum limit of 5MB.',
        });
      }
      return res.status(err.statusCode || 400).json({
        success: false,
        message: err.message || 'Image upload failed.',
      });
    }

    // If file was uploaded, verify magic bytes
    if (req.file) {
      try {
        validateImageMagicBytes(req.file.path);
      } catch (validationErr) {
        return res.status(validationErr.statusCode || 400).json({
          success: false,
          message: validationErr.message,
        });
      }
    }

    next();
  });
}

