import authService from '../services/auth.service.js';
import { setAuthCookie, clearAuthCookie } from '../utils/token.js';

export const authController = {
  /**
   * Super Admin Login
   */
  async loginSuperAdmin(req, res, next) {
    try {
      const { email, password } = req.body;
      const result = await authService.loginSuperAdmin({ email, password }, req.meta || {});

      // Set secure HTTP-only session cookie
      setAuthCookie(res, result.token, 'azzuniqe_session');

      res.json({
        success: true,
        message: 'Super Admin authenticated successfully',
        token: result.token,
        data: {
          ...result.user,
          user: result.user,
          token: result.token,
          redirectUrl: result.redirectUrl,
        },
        user: result.user,
        redirectUrl: result.redirectUrl,
      });
    } catch (err) {
      if (err.statusCode) {
        return res.status(err.statusCode).json({
          success: false,
          message: err.message,
          code: err.code || 'AUTH_FAILED',
        });
      }
      next(err);
    }
  },

  /**
   * Common Company User Login (Company Admin, Department Head, Employee)
   */
  async loginCompanyUser(req, res, next) {
    try {
      const { email, password, companyId } = req.body;
      const result = await authService.loginCompanyUser(
        { email, password, companyId },
        req.meta || {}
      );

      // Set secure HTTP-only cookie
      setAuthCookie(res, result.token, 'azzuniqe_session');

      res.json({
        success: true,
        message: 'Logged in successfully',
        token: result.token,
        data: {
          ...result.user,
          user: result.user,
          token: result.token,
          redirectUrl: result.redirectUrl,
          targetOrigin: result.targetOrigin,
        },
        user: result.user,
        redirectUrl: result.redirectUrl,
        targetOrigin: result.targetOrigin,
      });
    } catch (err) {
      if (err.statusCode) {
        return res.status(err.statusCode).json({
          success: false,
          message: err.message,
          code: err.code || 'AUTH_FAILED',
        });
      }
      next(err);
    }
  },

  /**
   * Get authenticated user profile
   */
  async getMe(req, res, next) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'No active authenticated session found.',
          code: 'UNAUTHENTICATED',
        });
      }

      const profile = await authService.getProfile(req.user);
      res.json({
        success: true,
        data: profile,
        user: profile,
      });
    } catch (err) {
      if (err.statusCode) {
        return res.status(err.statusCode).json({
          success: false,
          message: err.message,
          code: err.code || 'AUTH_ERROR',
        });
      }
      next(err);
    }
  },

  /**
   * Terminate session and invalidate auth cookies
   */
  async logout(req, res) {
    clearAuthCookie(res, 'azzuniqe_session');
    clearAuthCookie(res, 'azzuniqe_super_session');

    res.json({
      success: true,
      message: 'Session terminated successfully',
    });
  },

  /**
   * Request password reset link (Generic safe response)
   */
  async forgotPassword(req, res, next) {
    try {
      const { email } = req.body;
      const meta = {
        ip: req.ip || req.headers['x-forwarded-for'] || '127.0.0.1',
        userAgent: req.get('user-agent'),
        origin: req.get('origin'),
      };

      const result = await authService.requestPasswordReset({ email }, meta);
      res.json(result);
    } catch (err) {
      if (err.statusCode) {
        return res.status(err.statusCode).json({
          success: false,
          message: err.message,
          code: err.code || 'VALIDATION_ERROR',
        });
      }
      next(err);
    }
  },

  /**
   * Verify password reset token
   */
  async verifyResetToken(req, res, next) {
    try {
      const token = req.body.token || req.query.token;
      const email = req.body.email || req.query.email;

      const result = await authService.verifyResetToken({ token, email });
      res.json(result);
    } catch (err) {
      if (err.statusCode) {
        return res.status(err.statusCode).json({
          success: false,
          message: err.message,
          code: err.code || 'VALIDATION_ERROR',
        });
      }
      next(err);
    }
  },

  /**
   * Execute password reset
   */
  async resetPassword(req, res, next) {
    try {
      const { token, email, password } = req.body;
      const meta = {
        ip: req.ip || req.headers['x-forwarded-for'] || '127.0.0.1',
        userAgent: req.get('user-agent'),
      };

      const result = await authService.resetPassword({ token, email, password }, meta);
      res.json(result);
    } catch (err) {
      if (err.statusCode) {
        return res.status(err.statusCode).json({
          success: false,
          message: err.message,
          code: err.code || 'RESET_ERROR',
        });
      }
      next(err);
    }
  },

  /**
   * Update Super Admin Profile Name
   */
  async updateSuperAdminProfile(req, res, next) {
    try {
      const { name } = req.body;
      const meta = {
        ip: req.ip || req.headers['x-forwarded-for'] || '127.0.0.1',
        userAgent: req.get('user-agent'),
      };
      const result = await authService.updateSuperAdminProfile(req.user, { name }, meta);
      res.json(result);
    } catch (err) {
      if (err.statusCode) {
        return res.status(err.statusCode).json({
          success: false,
          message: err.message,
          code: err.code || 'VALIDATION_ERROR',
        });
      }
      next(err);
    }
  },

  /**
   * Update Super Admin Password
   */
  async updateSuperAdminPassword(req, res, next) {
    try {
      const { currentPassword, newPassword } = req.body;
      const meta = {
        ip: req.ip || req.headers['x-forwarded-for'] || '127.0.0.1',
        userAgent: req.get('user-agent'),
      };
      const result = await authService.updateSuperAdminPassword(req.user, { currentPassword, newPassword }, meta);
      res.json(result);
    } catch (err) {
      if (err.statusCode) {
        return res.status(err.statusCode).json({
          success: false,
          message: err.message,
          code: err.code || 'PASSWORD_UPDATE_FAILED',
        });
      }
      next(err);
    }
  },

  async updateCompanyAdminProfile(req, res, next) {
    try {
      const result = await authService.updateCompanyAdminProfile(req.user, req.body, req.meta || {});
      res.json(result);
    } catch (err) {
      if (err.statusCode) {
        return res.status(err.statusCode).json({
          success: false,
          message: err.message,
          code: err.code || 'PROFILE_UPDATE_FAILED',
        });
      }
      next(err);
    }
  },

  async updateCompanyAdminPassword(req, res, next) {
    try {
      const result = await authService.updateCompanyAdminPassword(req.user, req.body, req.meta || {});
      res.json(result);
    } catch (err) {
      if (err.statusCode) {
        return res.status(err.statusCode).json({
          success: false,
          message: err.message,
          code: err.code || 'PASSWORD_UPDATE_FAILED',
        });
      }
      next(err);
    }
  },

  async updateCompanyAdminCompany(req, res, next) {
    try {
      const result = await authService.updateCompanyAdminCompany(req.user, req.body, req.meta || {});
      res.json(result);
    } catch (err) {
      if (err.statusCode) {
        return res.status(err.statusCode).json({
          success: false,
          message: err.message,
          code: err.code || 'COMPANY_PROFILE_UPDATE_FAILED',
        });
      }
      next(err);
    }
  },
};

export default authController;
