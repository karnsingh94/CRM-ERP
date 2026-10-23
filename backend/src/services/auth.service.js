import crypto from 'crypto';
import prisma from '../config/prisma.js';
import { comparePassword, hashPassword } from '../utils/hash.js';
import { signToken } from '../utils/token.js';
import { clientAccessInclude, formatClient } from '../utils/formatters.js';
import auditService from './audit.service.js';
import logger from '../utils/logger.js';
import { sendPasswordResetEmail } from '../utils/mailer.js';
import { normalizeTeamPermissions } from '../utils/team-permissions.js';

// In-memory store for active password reset tokens
// key: tokenHash (SHA-256), value: { email, userId, userType, expiresAt, used }
const RESET_TOKENS = new Map();

// In-memory password override cache to immediately support resets for both DB & bootstrap fallback accounts
const PASSWORD_OVERRIDES = new Map();
const COMPANY_STAFF_ROLES = ['DEPARTMENT_HEAD', 'SERVICE_HEAD', 'TEAM_LEADER', 'EMPLOYEE'];
const DEFAULT_SESSION_SECONDS = 24 * 60 * 60;
const REMEMBERED_SESSION_SECONDS = 30 * DEFAULT_SESSION_SECONDS;

function sessionExpiry(rememberMe) {
  return rememberMe === true ? REMEMBERED_SESSION_SECONDS : DEFAULT_SESSION_SECONDS;
}

function hashResetToken(rawToken) {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}

function getEmployeeAccessRole(employee) {
  if (employee.team?.headEmployeeId === employee.id) return 'TEAM_LEADER';
  if (employee.accessRole === 'TEAM_LEADER') return 'TEAM_LEADER';
  return 'EMPLOYEE';
}

function scopeAccessToEmployeeService(access, service, permissions = null, isTeamLeader = false) {
  if (!service) return { ...(access || {}), services: [] };
  const serviceId = String(service.id);
  const scopedServices = (access?.services || []).filter(
    (entry) => String(entry.serviceId || entry.service_id || entry.id) === serviceId
  );
  if (!isTeamLeader) return { ...(access || {}), services: scopedServices };

  const featureAccess = permissions?.featureAccess || {};
  const permittedModules = new Set((featureAccess.moduleIds || []).map(String));
  const permittedSubModules = new Set((featureAccess.subModuleIds || []).map(String));
  return {
    ...(access || {}),
    services: scopedServices.map((entry) => {
      const modules = (entry.modules || []).flatMap((module) => {
        const moduleId = String(module.moduleId || module.module_id || module.id);
        if (permittedModules.has(moduleId)) {
          return [{
            ...module,
            access_mode: 'FULL',
            accessMode: 'FULL',
          }];
        }
        const subModules = (module.subModules || module.sub_modules || []).filter(
          (subModule) => permittedSubModules.has(String(subModule.id))
        );
        if (!subModules.length) return [];
        return [{
          ...module,
          access_mode: 'CUSTOM',
          accessMode: 'CUSTOM',
          sub_module_ids: subModules.map((subModule) => String(subModule.id)),
          subModules,
          sub_modules: subModules,
        }];
      });
      return { ...entry, full_service: false, isFullService: false, modules };
    }),
  };
}


// Default Super Admin credentials for initial platform bootstrap
const BOOTSTRAP_SUPER_ADMIN = {
  id: '1',
  name: 'Platform Super Admin',
  email: 'admin@azzuniqe.com',
  password: 'SuperAdmin@2026!',
  role: 'SUPER_ADMIN',
};

// No dummy bootstrap company users - strictly tenant databases
const BOOTSTRAP_COMPANY_USERS = [];

export const authService = {
  /**
   * Ensure default Super Admin account exists in database if database is accessible
   */
  async ensureDefaultSuperAdmin() {
    try {
      const existing = await prisma.superAdmin.findUnique({
        where: { email: BOOTSTRAP_SUPER_ADMIN.email },
      });
      if (!existing) {
        const passwordHash = hashPassword(BOOTSTRAP_SUPER_ADMIN.password);
        await prisma.superAdmin.create({
          data: {
            name: BOOTSTRAP_SUPER_ADMIN.name,
            email: BOOTSTRAP_SUPER_ADMIN.email,
            passwordHash,
            status: 'ACTIVE',
          },
        });
        logger.info('Default Super Admin account initialized in database.');
      }
    } catch (err) {
      // In offline database mode, the bootstrap fallback will still allow platform management
      logger.debug('Database check for default super admin deferred:', err.message);
    }
  },

  /**
   * Authenticate Super Admin (Platform Owner)
   */
  async loginSuperAdmin({ email, password, rememberMe = false }, meta = {}) {
    if (!email || !password) {
      const error = new Error('Email and password are required');
      error.statusCode = 400;
      throw error;
    }

    const cleanEmail = email.trim().toLowerCase();
    let superAdmin = null;

    try {
      superAdmin = await prisma.superAdmin.findUnique({
        where: { email: cleanEmail },
      });
    } catch (err) {
      logger.warn('Database error while locating super admin:', err.message);
    }

    // Match database record or bootstrap fallback
    let isValid = false;
    let userObj = null;

    if (PASSWORD_OVERRIDES.has(cleanEmail) && (superAdmin || cleanEmail === BOOTSTRAP_SUPER_ADMIN.email.toLowerCase())) {
      isValid = comparePassword(password, PASSWORD_OVERRIDES.get(cleanEmail));
      if (isValid) {
        userObj = {
          id: superAdmin ? superAdmin.id.toString() : BOOTSTRAP_SUPER_ADMIN.id,
          name: superAdmin ? superAdmin.name : BOOTSTRAP_SUPER_ADMIN.name,
          email: cleanEmail,
          role: 'SUPER_ADMIN',
        };
      }
    } else if (superAdmin) {
      if (superAdmin.status !== 'ACTIVE') {
        const error = new Error('Your Super Admin account has been deactivated. Contact platform owner.');
        error.statusCode = 403;
        throw error;
      }
      isValid = comparePassword(password, superAdmin.passwordHash);
      if (isValid) {
        userObj = {
          id: superAdmin.id.toString(),
          name: superAdmin.name,
          email: superAdmin.email,
          role: 'SUPER_ADMIN',
        };
        // Update last login
        prisma.superAdmin
          .update({
            where: { id: superAdmin.id },
            data: { lastLoginAt: new Date() },
          })
          .catch(() => {});
      }
    } else if (cleanEmail === BOOTSTRAP_SUPER_ADMIN.email && password === BOOTSTRAP_SUPER_ADMIN.password) {
      // Bootstrap fallback
      isValid = true;
      userObj = {
        id: BOOTSTRAP_SUPER_ADMIN.id,
        name: BOOTSTRAP_SUPER_ADMIN.name,
        email: BOOTSTRAP_SUPER_ADMIN.email,
        role: 'SUPER_ADMIN',
      };
      // Asynchronously persist to database if connection is restored
      this.ensureDefaultSuperAdmin().catch(() => {});
    }

    if (!isValid || !userObj) {
      const error = new Error('Invalid Super Admin credentials. Please verify your email and password.');
      error.statusCode = 401;
      error.code = 'INVALID_CREDENTIALS';
      throw error;
    }

    const expiresInSeconds = sessionExpiry(rememberMe);
    const token = signToken({
      userId: userObj.id,
      name: userObj.name,
      email: userObj.email,
      role: 'SUPER_ADMIN',
      type: 'SUPER_ADMIN',
    }, expiresInSeconds);

    await auditService.logAudit({
      action: 'LOGIN',
      entityType: 'SUPER_ADMIN',
      entityId: userObj.id,
      reason: `Super Admin "${userObj.name}" logged in successfully`,
      ipAddress: meta.ip || '127.0.0.1',
      userAgent: meta.userAgent || null,
    });

    return {
      token,
      expiresInSeconds,
      user: userObj,
      redirectUrl: '/dashboard',
    };
  },

  /**
   * Unified Canonical Login for ALL Roles: Super Admin, Company Admin, Department Head, Employee
   */
  async loginCompanyUser({ email, password, companyId, rememberMe = false }, meta = {}) {
    if (!email || !password) {
      const error = new Error('Email and password are required');
      error.statusCode = 400;
      throw error;
    }

    const cleanEmail = email.trim().toLowerCase();
    const expiresInSeconds = sessionExpiry(rememberMe);

    // 0. Check if user is Super Admin (Platform Owner)
    let superAdmin = null;
    try {
      superAdmin = await prisma.superAdmin.findUnique({
        where: { email: cleanEmail },
      });
    } catch {}

    if (PASSWORD_OVERRIDES.has(cleanEmail) && (superAdmin || cleanEmail === BOOTSTRAP_SUPER_ADMIN.email.toLowerCase())) {
      if (comparePassword(password, PASSWORD_OVERRIDES.get(cleanEmail))) {
        const userObj = {
          id: superAdmin ? superAdmin.id.toString() : BOOTSTRAP_SUPER_ADMIN.id,
          name: superAdmin ? superAdmin.name : BOOTSTRAP_SUPER_ADMIN.name,
          email: cleanEmail,
          role: 'SUPER_ADMIN',
        };
        const token = signToken({
          userId: userObj.id,
          name: userObj.name,
          email: userObj.email,
          role: 'SUPER_ADMIN',
          type: 'SUPER_ADMIN',
        }, expiresInSeconds);
        await auditService.logAudit({
          action: 'LOGIN',
          entityType: 'SUPER_ADMIN',
          entityId: userObj.id,
          reason: `Super Admin "${userObj.name}" authenticated via Unified Login`,
          ipAddress: meta.ip || '127.0.0.1',
          userAgent: meta.userAgent || null,
        });
        return {
          token,
          expiresInSeconds,
          user: userObj,
          redirectUrl: '/',
          targetOrigin: 'http://localhost:3000',
        };
      }
    } else if (superAdmin) {
      if (superAdmin.status !== 'ACTIVE') {
        const error = new Error('Your Super Admin account has been deactivated. Contact platform owner.');
        error.statusCode = 403;
        throw error;
      }
      if (comparePassword(password, superAdmin.passwordHash)) {
        const userObj = {
          id: superAdmin.id.toString(),
          name: superAdmin.name,
          email: superAdmin.email,
          role: 'SUPER_ADMIN',
        };
        const token = signToken({
          userId: userObj.id,
          name: userObj.name,
          email: userObj.email,
          role: 'SUPER_ADMIN',
          type: 'SUPER_ADMIN',
        }, expiresInSeconds);
        await auditService.logAudit({
          action: 'LOGIN',
          entityType: 'SUPER_ADMIN',
          entityId: userObj.id,
          reason: `Super Admin "${userObj.name}" authenticated via Unified Login`,
          ipAddress: meta.ip || '127.0.0.1',
          userAgent: meta.userAgent || null,
        });
        return {
          token,
          expiresInSeconds,
          user: userObj,
          redirectUrl: '/',
          targetOrigin: 'http://localhost:3000',
        };
      }
    } else if (cleanEmail === BOOTSTRAP_SUPER_ADMIN.email.toLowerCase() && password === BOOTSTRAP_SUPER_ADMIN.password) {
      const userObj = {
        id: BOOTSTRAP_SUPER_ADMIN.id,
        name: BOOTSTRAP_SUPER_ADMIN.name,
        email: BOOTSTRAP_SUPER_ADMIN.email,
        role: 'SUPER_ADMIN',
      };
      const token = signToken({
        userId: userObj.id,
        name: userObj.name,
        email: userObj.email,
        role: 'SUPER_ADMIN',
        type: 'SUPER_ADMIN',
      }, expiresInSeconds);
      return {
        token,
        expiresInSeconds,
        user: userObj,
        redirectUrl: '/',
        targetOrigin: 'http://localhost:3000',
      };
    }

    // 1. Check if user is a Company Administrator (ClientAdmin)
    let clientAdmin = null;
    try {
      clientAdmin = await prisma.clientAdmin.findFirst({
        where: {
          email: cleanEmail,
          deletedAt: null,
          ...(companyId ? { id: String(companyId) } : {}),
        },
        include: clientAccessInclude,
      });
    } catch (err) {
      logger.warn('Database error while locating client admin:', err.message);
    }

    if (clientAdmin) {
      if (clientAdmin.status !== 'ACTIVE') {
        const error = new Error(`Company workspace for "${clientAdmin.organizationName}" is currently INACTIVE.`);
        error.statusCode = 403;
        error.code = 'TENANT_INACTIVE';
        throw error;
      }

      let isPasswordValid = false;
      if (PASSWORD_OVERRIDES.has(cleanEmail)) {
        isPasswordValid = comparePassword(password, PASSWORD_OVERRIDES.get(cleanEmail));
      } else {
        isPasswordValid = comparePassword(password, clientAdmin.passwordHash);
      }
      if (isPasswordValid) {
        const formatted = formatClient(clientAdmin);
        const userObj = {
          id: clientAdmin.id.toString(),
          name: clientAdmin.name,
          email: clientAdmin.email,
          role: 'COMPANY_ADMIN',
          companyId: clientAdmin.id.toString(),
          organizationName: clientAdmin.organizationName,
          themeColor: clientAdmin.themeColor || '#7f22fe',
          theme_color: clientAdmin.themeColor || '#7f22fe',
          access: formatted.access,
        };

        const token = signToken({
          userId: userObj.id,
          name: userObj.name,
          email: userObj.email,
          role: 'COMPANY_ADMIN',
          companyId: userObj.companyId,
          organizationName: userObj.organizationName,
          type: 'COMPANY_USER',
        });

        await auditService.logAudit({
          action: 'LOGIN',
          entityType: 'CLIENT_ADMIN',
          entityId: clientAdmin.id,
          reason: `Company Admin "${clientAdmin.name}" (${clientAdmin.organizationName}) logged in`,
          ipAddress: meta.ip || '127.0.0.1',
          userAgent: meta.userAgent || null,
        });

        return {
          token,
          user: userObj,
          redirectUrl: '/dashboard',
          targetOrigin: process.env.CLIENT_URL || 'http://localhost:3000',
        };
      }
    }

    // 2. Check if user is an Employee or Department Head (CompanyEmployee)
    let employee = null;
    try {
      employee = await prisma.companyEmployee.findFirst({
        where: {
          email: cleanEmail,
          status: 'ACTIVE',
          ...(companyId ? { companyId: String(companyId) } : {}),
        },
        include: {
          clientAdmin: {
            include: clientAccessInclude,
          },
          department: { include: { service: true } },
          headedDepartments: true,
          team: {
            include: {
              service: true,
              head: true,
            },
          },
        },
      });
    } catch (err) {
      logger.warn('Database error while locating company employee:', err.message);
    }

    if (employee && employee.clientAdmin && employee.clientAdmin.deletedAt === null) {
      if (employee.clientAdmin.status !== 'ACTIVE') {
        const error = new Error(`Company workspace for "${employee.clientAdmin.organizationName}" is inactive.`);
        error.statusCode = 403;
        throw error;
      }

      // Existing migrated accounts without an individual password retain the legacy company-password login.
      let isEmployeeValid = false;
      if (PASSWORD_OVERRIDES.has(cleanEmail)) {
        isEmployeeValid = comparePassword(password, PASSWORD_OVERRIDES.get(cleanEmail));
      } else if (employee.passwordHash) {
        isEmployeeValid = comparePassword(password, employee.passwordHash);
      } else {
        isEmployeeValid = comparePassword(password, employee.clientAdmin.passwordHash);
      }

      if (isEmployeeValid) {
        const resolvedRole = getEmployeeAccessRole(employee);
        const service = employee.team?.service || employee.department?.service;
        const formattedCompany = formatClient(employee.clientAdmin);
        const isTeamLeader = resolvedRole === 'TEAM_LEADER';
        const employeePermissions = normalizeTeamPermissions(employee.permissions);
        const scopedAccess = scopeAccessToEmployeeService(formattedCompany.access, service, employeePermissions, isTeamLeader);

        const userObj = {
          id: employee.id.toString(),
          name: employee.name,
          email: employee.email,
          role: resolvedRole,
          rawRole: employee.role,
          accessRole: employee.accessRole,
          permissions: employeePermissions,
          companyId: employee.companyId.toString(),
          departmentId: employee.departmentId ? employee.departmentId.toString() : null,
          teamId: employee.teamId ? employee.teamId.toString() : null,
          serviceId: service?.id.toString() || null,
          serviceName: service?.name || employee.department?.name || null,
          serviceCode: service?.code || null,
          departmentName: service?.name || employee.department?.name || null,
          departmentServiceCode: employee.department?.service?.code || null,
          organizationName: employee.clientAdmin.organizationName,
          themeColor: employee.clientAdmin?.themeColor || '#7f22fe',
          theme_color: employee.clientAdmin?.themeColor || '#7f22fe',
          access: scopedAccess,
        };

        const token = signToken({
          userId: userObj.id,
          name: userObj.name,
          email: userObj.email,
          role: resolvedRole,
          companyId: userObj.companyId,
          departmentId: userObj.departmentId,
          teamId: userObj.teamId,
          serviceId: userObj.serviceId,
          serviceCode: userObj.serviceCode,
          organizationName: userObj.organizationName,
          type: 'COMPANY_USER',
        });

        await auditService.logAudit({
          action: 'LOGIN',
          entityType: 'COMPANY_EMPLOYEE',
          entityId: employee.id,
          reason: `${resolvedRole} "${employee.name}" logged into company #${employee.companyId}`,
          ipAddress: meta.ip || '127.0.0.1',
          userAgent: meta.userAgent || null,
        });

        // Determine destination based on role
        const redirectUrl = '/dashboard';

        return {
          token,
          user: userObj,
          redirectUrl,
          targetOrigin: process.env.CLIENT_URL || 'http://localhost:3000',
        };
      }
    }

    // 3. Fallback for offline development / bootstrap company users
    const fallbackUser = BOOTSTRAP_COMPANY_USERS.find(
      (u) => u.email.toLowerCase() === cleanEmail && (!companyId || u.companyId === String(companyId))
    );

    let isFallbackValid = false;
    if (fallbackUser) {
      if (PASSWORD_OVERRIDES.has(cleanEmail)) {
        isFallbackValid = comparePassword(password, PASSWORD_OVERRIDES.get(cleanEmail));
      } else {
        isFallbackValid = fallbackUser.password === password;
      }
    }
    if (fallbackUser && isFallbackValid) {
      const userObj = {
        id: fallbackUser.id,
        name: fallbackUser.name,
        email: fallbackUser.email,
        role: fallbackUser.role,
        companyId: fallbackUser.companyId,
        departmentId: fallbackUser.departmentId || null,
        departmentName: fallbackUser.departmentName || null,
        organizationName: fallbackUser.organizationName,
        access: { services: [] },
      };

      const token = signToken({
        userId: userObj.id,
        name: userObj.name,
        email: userObj.email,
        role: userObj.role,
        companyId: userObj.companyId,
        departmentId: userObj.departmentId,
        organizationName: userObj.organizationName,
        type: 'COMPANY_USER',
      });

      return {
        token,
        user: userObj,
        redirectUrl: '/dashboard',
        targetOrigin: process.env.CLIENT_URL || 'http://localhost:3000',
      };
    }

    const error = new Error('Invalid email or password. Please check your credentials.');
    error.statusCode = 401;
    error.code = 'INVALID_CREDENTIALS';
    throw error;
  },

  /**
   * Get fresh authenticated identity and permissions profile
   */
  async getProfile(userPayload) {
    if (!userPayload || !userPayload.userId) {
      const error = new Error('Unauthenticated');
      error.statusCode = 401;
      throw error;
    }

    if (userPayload.role === 'SUPER_ADMIN') {
      try {
        const superAdmin = await prisma.superAdmin.findUnique({
          where: { id: String(userPayload.userId) },
        });
        if (superAdmin) {
          return {
            id: superAdmin.id.toString(),
            name: superAdmin.name,
            email: superAdmin.email,
            role: 'SUPER_ADMIN',
            status: superAdmin.status,
            lastLoginAt: superAdmin.lastLoginAt,
            createdAt: superAdmin.createdAt,
          };
        }
      } catch {}

      return {
        id: userPayload.userId,
        name: userPayload.name || 'Super Admin',
        email: userPayload.email,
        role: 'SUPER_ADMIN',
      };
    }

    if (userPayload.role === 'COMPANY_ADMIN') {
      try {
        const client = await prisma.clientAdmin.findUnique({
          where: { id: String(userPayload.companyId || userPayload.userId) },
          include: clientAccessInclude,
        });

        if (client && !client.deletedAt) {
          const formatted = formatClient(client);
          return {
            id: client.id.toString(),
            name: client.name,
            email: client.email,
            role: 'COMPANY_ADMIN',
            organizationName: client.organizationName,
            companyId: client.id.toString(),
            themeColor: client.themeColor || '#7f22fe',
            theme_color: client.themeColor || '#7f22fe',
            access: formatted.access,
          };
        }
      } catch {}

      return {
        id: userPayload.userId,
        name: userPayload.name || 'Company Admin',
        email: userPayload.email,
        role: 'COMPANY_ADMIN',
        organizationName: userPayload.organizationName || 'Company Workspace',
        companyId: userPayload.companyId,
        access: { services: [] },
      };
    }

    if (COMPANY_STAFF_ROLES.includes(userPayload.role)) {
      try {
        const employee = await prisma.companyEmployee.findUnique({
          where: { id: String(userPayload.userId) },
          include: {
            clientAdmin: { include: clientAccessInclude },
            department: { include: { service: true } },
            headedDepartments: true,
            team: { include: { service: true, head: true } },
          },
        });

        if (employee) {
          const formattedCompany = formatClient(employee.clientAdmin);
          const role = getEmployeeAccessRole(employee);
          const service = employee.team?.service || employee.department?.service;

          return {
            id: employee.id.toString(),
            name: employee.name,
            email: employee.email,
            role,
            rawRole: employee.role,
            accessRole: employee.accessRole,
            permissions: normalizeTeamPermissions(employee.permissions),
            companyId: employee.companyId.toString(),
            departmentId: employee.departmentId ? employee.departmentId.toString() : null,
            teamId: employee.teamId ? employee.teamId.toString() : null,
            serviceId: service?.id.toString() || null,
            serviceName: service?.name || employee.department?.name || null,
            serviceCode: service?.code || null,
            departmentName: service?.name || employee.department?.name || null,
            departmentServiceCode: employee.department?.service?.code || null,
            organizationName: employee.clientAdmin?.organizationName || '',
            themeColor: employee.clientAdmin?.themeColor || '#7f22fe',
            theme_color: employee.clientAdmin?.themeColor || '#7f22fe',
            access: scopeAccessToEmployeeService(
              formattedCompany.access,
              service,
              normalizeTeamPermissions(employee.permissions),
              role === 'TEAM_LEADER'
            ),
          };
        }
      } catch {}

      return {
        id: userPayload.userId,
        name: userPayload.name || 'Company User',
        email: userPayload.email,
        role: userPayload.role,
        companyId: userPayload.companyId,
        departmentId: userPayload.departmentId || null,
        organizationName: userPayload.organizationName || 'Company Workspace',
        access: { services: [] },
      };
    }

    return userPayload;
  },

  async loginUnified(params, meta = {}) {
    return this.loginCompanyUser(params, meta);
  },

  /**
   * Request password reset link for any valid platform role
   * Returns generic safe response without leaking user existence
   */
  async requestPasswordReset({ email }, meta = {}) {
    if (!email || typeof email !== 'string') {
      const error = new Error('Valid email address is required.');
      error.statusCode = 400;
      throw error;
    }

    const cleanEmail = email.trim().toLowerCase();
    const genericResponse = {
      success: true,
      message: 'If an account exists for this email address, password reset instructions will be sent.',
    };

    // Locate target account across all supported roles
    let account = null;

    // 1. Super Admin check
    try {
      const sa = await prisma.superAdmin.findUnique({ where: { email: cleanEmail } });
      if (sa && sa.status === 'ACTIVE') {
        account = { id: sa.id.toString(), email: sa.email, userType: 'SUPER_ADMIN' };
      }
    } catch {}

    if (!account && cleanEmail === BOOTSTRAP_SUPER_ADMIN.email.toLowerCase()) {
      account = { id: BOOTSTRAP_SUPER_ADMIN.id, email: BOOTSTRAP_SUPER_ADMIN.email, userType: 'SUPER_ADMIN' };
    }

    // 2. Client Admin check
    if (!account) {
      try {
        const ca = await prisma.clientAdmin.findFirst({
          where: { email: cleanEmail, deletedAt: null, status: 'ACTIVE' },
        });
        if (ca) {
          account = { id: ca.id.toString(), email: ca.email, userType: 'CLIENT_ADMIN' };
        }
      } catch {}
    }

    // 3. Company Employee check
    if (!account) {
      try {
        const emp = await prisma.companyEmployee.findFirst({
          where: { email: cleanEmail, status: 'ACTIVE' },
          include: { clientAdmin: true },
        });
        if (emp && emp.clientAdmin && emp.clientAdmin.status === 'ACTIVE') {
          account = { id: emp.id.toString(), email: emp.email, userType: 'COMPANY_EMPLOYEE' };
        }
      } catch {}
    }

    // 4. Fallback user check
    if (!account) {
      const fb = BOOTSTRAP_COMPANY_USERS.find((u) => u.email.toLowerCase() === cleanEmail);
      if (fb) {
        account = { id: fb.id, email: fb.email, userType: 'COMPANY_USER' };
      }
    }

    // If account not found, return generic message immediately
    if (!account) {
      return genericResponse;
    }

    // Generate cryptographically secure 256-bit token
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = hashResetToken(rawToken);
    const ttlMs = 15 * 60 * 1000; // 15 minutes TTL

    RESET_TOKENS.set(tokenHash, {
      email: cleanEmail,
      userId: account.id,
      userType: account.userType,
      expiresAt: Date.now() + ttlMs,
      used: false,
    });

    // Cleanup expired tokens periodically
    const now = Date.now();
    for (const [hash, record] of RESET_TOKENS.entries()) {
      if (record.used || now > record.expiresAt) {
        RESET_TOKENS.delete(hash);
      }
    }

    // Determine correct frontend base URL
      frontendBase = meta.origin || process.env.CLIENT_URL || 'http://localhost:3000';
    const resetUrl = `${frontendBase}/reset-password?token=${rawToken}&email=${encodeURIComponent(cleanEmail)}`;

    // Dispatch email safely
    await sendPasswordResetEmail({ to: cleanEmail, resetUrl });

    await auditService.logAudit({
      action: 'FORGOT_PASSWORD_REQUEST',
      entityType: account.userType,
      entityId: account.id,
      reason: `Password reset link requested for ${cleanEmail}`,
      ipAddress: meta.ip || '127.0.0.1',
      userAgent: meta.userAgent || null,
    });

    // In development or test mode, provide devResetLink for seamless local testing
    if (process.env.NODE_ENV !== 'production') {
      return {
        ...genericResponse,
        devResetLink: resetUrl,
        resetToken: rawToken,
      };
    }

    return genericResponse;
  },

  /**
   * Verify validity of a password reset token
   */
  async verifyResetToken({ token, email }) {
    if (!token || typeof token !== 'string') {
      return { valid: false, message: 'Password reset token is missing.' };
    }

    const tokenHash = hashResetToken(token.trim());
    const record = RESET_TOKENS.get(tokenHash);

    if (!record) {
      return { valid: false, message: 'Password reset link is invalid or has already been used.' };
    }

    if (record.used) {
      return { valid: false, message: 'Password reset link has already been used.' };
    }

    if (Date.now() > record.expiresAt) {
      RESET_TOKENS.delete(tokenHash);
      return { valid: false, message: 'Password reset link has expired. Please request a new one.' };
    }

    if (email && record.email !== email.trim().toLowerCase()) {
      return { valid: false, message: 'Password reset link does not match the requested account.' };
    }

    return { valid: true, email: record.email };
  },

  /**
   * Complete password reset for authenticated token
   */
  async resetPassword({ token, email, password }, meta = {}) {
    if (!token || typeof token !== 'string') {
      const error = new Error('Reset token is required.');
      error.statusCode = 400;
      throw error;
    }

    if (!password || password.length < 8) {
      const error = new Error('Password must be at least 8 characters long.');
      error.statusCode = 400;
      throw error;
    }

    const tokenHash = hashResetToken(token.trim());
    const record = RESET_TOKENS.get(tokenHash);

    if (!record || record.used || Date.now() > record.expiresAt) {
      const error = new Error('Password reset token is invalid or has expired.');
      error.statusCode = 400;
      error.code = 'INVALID_OR_EXPIRED_TOKEN';
      throw error;
    }

    if (email && record.email !== email.trim().toLowerCase()) {
      const error = new Error('Reset token does not match the provided email.');
      error.statusCode = 400;
      throw error;
    }

    // Invalidate token immediately
    record.used = true;
    RESET_TOKENS.delete(tokenHash);

    // Hash new password securely with standard bcrypt
    const newPasswordHash = hashPassword(password);

    // Cache override so new password takes effect immediately across all routes
    PASSWORD_OVERRIDES.set(record.email, newPasswordHash);

    // Update database record where applicable
    if (record.userType === 'SUPER_ADMIN') {
      try {
        await prisma.superAdmin.update({
          where: { email: record.email },
          data: { passwordHash: newPasswordHash },
        });
      } catch (err) {
        logger.debug('Super Admin database password update deferred:', err.message);
      }
    } else if (record.userType === 'CLIENT_ADMIN') {
      try {
        await prisma.clientAdmin.update({
          where: { email: record.email },
          data: { passwordHash: newPasswordHash },
        });
      } catch (err) {
        logger.debug('Client Admin database password update deferred:', err.message);
      }
    } else if (record.userType === 'COMPANY_EMPLOYEE') {
      try {
        await prisma.companyEmployee.update({
          where: { id: String(record.userId) },
          data: { passwordHash: newPasswordHash },
        });
      } catch (err) {
        logger.debug('Company Employee database password update deferred:', err.message);
      }
    }

    await auditService.logAudit({
      action: 'PASSWORD_RESET',
      entityType: record.userType,
      entityId: record.userId,
      reason: `Password successfully reset for account ${record.email}`,
      ipAddress: meta.ip || '127.0.0.1',
      userAgent: meta.userAgent || null,
    });

    return {
      success: true,
      message: 'Your password has been reset successfully. You can now log in with your new credentials.',
    };
  },

  /**
   * Update Super Admin profile name
   */
  async updateSuperAdminProfile(userPayload, { name }, meta = {}) {
    if (!userPayload || userPayload.role !== 'SUPER_ADMIN') {
      const error = new Error('Access denied: Only Super Admin can update platform profile.');
      error.statusCode = 403;
      throw error;
    }
    const cleanName = (name || '').trim();
    if (!cleanName || cleanName.length < 2) {
      const error = new Error('Profile name must be at least 2 characters.');
      error.statusCode = 400;
      throw error;
    }

    let updatedUser = null;
    try {
      const updated = await prisma.superAdmin.update({
        where: { id: String(userPayload.userId) },
        data: { name: cleanName },
      });
      updatedUser = {
        id: updated.id.toString(),
        name: updated.name,
        email: updated.email,
        role: 'SUPER_ADMIN',
        status: updated.status,
        lastLoginAt: updated.lastLoginAt,
        createdAt: updated.createdAt,
      };
    } catch (err) {
      BOOTSTRAP_SUPER_ADMIN.name = cleanName;
      updatedUser = {
        id: userPayload.userId,
        name: cleanName,
        email: userPayload.email,
        role: 'SUPER_ADMIN',
        status: 'ACTIVE',
      };
    }

    await auditService.logAudit({
      action: 'UPDATE_PROFILE',
      entityType: 'SUPER_ADMIN',
      entityId: userPayload.userId,
      reason: `Super Admin profile updated name to "${cleanName}"`,
      ipAddress: meta.ip || '127.0.0.1',
      userAgent: meta.userAgent || null,
    });

    return {
      success: true,
      message: 'Super Admin profile updated successfully',
      data: updatedUser,
      user: updatedUser,
    };
  },

  /**
   * Update Super Admin password with current password verification
   */
  async updateSuperAdminPassword(userPayload, { currentPassword, newPassword }, meta = {}) {
    if (!userPayload || userPayload.role !== 'SUPER_ADMIN') {
      const error = new Error('Access denied: Only Super Admin can update platform password.');
      error.statusCode = 403;
      throw error;
    }

    if (!currentPassword) {
      const error = new Error('Current password is required.');
      error.statusCode = 400;
      throw error;
    }

    if (!newPassword || newPassword.length < 8) {
      const error = new Error('New password must be at least 8 characters long.');
      error.statusCode = 400;
      throw error;
    }

    const cleanEmail = (userPayload.email || '').trim().toLowerCase();
    let superAdmin = null;
    try {
      superAdmin = await prisma.superAdmin.findUnique({
        where: { id: String(userPayload.userId) },
      });
    } catch {}

    // Verify current password
    let isCurrentValid = false;
    if (PASSWORD_OVERRIDES.has(cleanEmail)) {
      isCurrentValid = comparePassword(currentPassword, PASSWORD_OVERRIDES.get(cleanEmail));
    } else if (superAdmin) {
      isCurrentValid = comparePassword(currentPassword, superAdmin.passwordHash);
    } else if (cleanEmail === BOOTSTRAP_SUPER_ADMIN.email && currentPassword === BOOTSTRAP_SUPER_ADMIN.password) {
      isCurrentValid = true;
    }

    if (!isCurrentValid) {
      const error = new Error('The current password entered is incorrect.');
      error.statusCode = 400;
      throw error;
    }

    // Hash new password
    const newPasswordHash = hashPassword(newPassword);
    PASSWORD_OVERRIDES.set(cleanEmail, newPasswordHash);

    if (superAdmin) {
      try {
        await prisma.superAdmin.update({
          where: { id: superAdmin.id },
          data: { passwordHash: newPasswordHash },
        });
      } catch (err) {
        logger.debug('Super Admin database password update deferred:', err.message);
      }
    } else if (cleanEmail === BOOTSTRAP_SUPER_ADMIN.email) {
      BOOTSTRAP_SUPER_ADMIN.password = newPassword;
    }

    await auditService.logAudit({
      action: 'UPDATE_PASSWORD',
      entityType: 'SUPER_ADMIN',
      entityId: userPayload.userId,
      reason: `Super Admin password successfully updated for account ${cleanEmail}`,
      ipAddress: meta.ip || '127.0.0.1',
      userAgent: meta.userAgent || null,
    });

    return {
      success: true,
      message: 'Password updated successfully.',
    };
  },

  async updateCompanyAdminProfile(userPayload, { name } = {}, meta = {}) {
    if (userPayload?.role !== 'COMPANY_ADMIN' || !userPayload.companyId) {
      const error = new Error('Access denied: Company Admin privileges required.');
      error.statusCode = 403;
      throw error;
    }

    const cleanName = typeof name === 'string' ? name.trim() : '';
    if (cleanName.length < 2 || cleanName.length > 150) {
      const error = new Error('Profile name must be between 2 and 150 characters.');
      error.statusCode = 400;
      throw error;
    }

    const companyId = String(userPayload.companyId);
    const existing = await prisma.clientAdmin.findUnique({ where: { id: companyId } });
    if (!existing || existing.deletedAt || existing.status !== 'ACTIVE') {
      const error = new Error('Active company admin account not found.');
      error.statusCode = 404;
      throw error;
    }

    const updated = await prisma.clientAdmin.update({
      where: { id: companyId },
      data: { name: cleanName },
    });

    await auditService.logAudit({
      action: 'UPDATE_PROFILE',
      entityType: 'CLIENT_ADMIN',
      entityId: updated.id,
      oldValue: { name: existing.name },
      newValue: { name: updated.name },
      reason: `Company Admin profile name updated for "${updated.organizationName}"`,
      ipAddress: meta.ip || '127.0.0.1',
      userAgent: meta.userAgent || null,
    });

    return {
      success: true,
      message: 'Profile updated successfully.',
      data: { id: updated.id.toString(), name: updated.name, email: updated.email },
    };
  },

  async updateCompanyAdminPassword(userPayload, { currentPassword, newPassword } = {}, meta = {}) {
    if (userPayload?.role !== 'COMPANY_ADMIN' || !userPayload.companyId) {
      const error = new Error('Access denied: Company Admin privileges required.');
      error.statusCode = 403;
      throw error;
    }
    if (typeof currentPassword !== 'string' || !currentPassword) {
      const error = new Error('Current password is required.');
      error.statusCode = 400;
      throw error;
    }
    if (
      typeof newPassword !== 'string' ||
      newPassword.length < 8 ||
      !/[A-Z]/.test(newPassword) ||
      !/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`]/.test(newPassword)
    ) {
      const error = new Error('New password must be at least 8 characters and include an uppercase letter and a special character.');
      error.statusCode = 400;
      throw error;
    }

    const companyId = String(userPayload.companyId);
    const existing = await prisma.clientAdmin.findUnique({ where: { id: companyId } });
    if (!existing || existing.deletedAt || existing.status !== 'ACTIVE') {
      const error = new Error('Active company admin account not found.');
      error.statusCode = 404;
      throw error;
    }
    if (!comparePassword(currentPassword, existing.passwordHash)) {
      const error = new Error('The current password entered is incorrect.');
      error.statusCode = 400;
      throw error;
    }

    const newPasswordHash = hashPassword(newPassword);
    await prisma.clientAdmin.update({
      where: { id: companyId },
      data: { passwordHash: newPasswordHash },
    });
    PASSWORD_OVERRIDES.set(existing.email.trim().toLowerCase(), newPasswordHash);

    await auditService.logAudit({
      action: 'UPDATE_PASSWORD',
      entityType: 'CLIENT_ADMIN',
      entityId: existing.id,
      reason: `Company Admin password updated for "${existing.organizationName}"`,
      ipAddress: meta.ip || '127.0.0.1',
      userAgent: meta.userAgent || null,
    });

    return { success: true, message: 'Password updated successfully.' };
  },

  async updateCompanyEmployeePassword(userPayload, { currentPassword, newPassword } = {}, meta = {}) {
    if (!COMPANY_STAFF_ROLES.includes(userPayload?.role)) {
      const error = new Error('Access denied: only company staff can update their own password here.');
      error.statusCode = 403;
      throw error;
    }
    if (typeof currentPassword !== 'string' || !currentPassword) {
      const error = new Error('Current password is required.');
      error.statusCode = 400;
      throw error;
    }
    if (
      typeof newPassword !== 'string' ||
      newPassword.length < 8 ||
      !/[A-Z]/.test(newPassword) ||
      !/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`]/.test(newPassword)
    ) {
      const error = new Error('New password must be at least 8 characters and include an uppercase letter and a special character.');
      error.statusCode = 400;
      throw error;
    }

    const employee = await prisma.companyEmployee.findFirst({
      where: {
        id: String(userPayload.userId),
        companyId: String(userPayload.companyId),
        status: 'ACTIVE',
      },
      include: { clientAdmin: true },
    });
    if (!employee || employee.clientAdmin?.deletedAt || employee.clientAdmin?.status !== 'ACTIVE') {
      const error = new Error('Active company employee account not found.');
      error.statusCode = 404;
      throw error;
    }

    const currentHash =
      PASSWORD_OVERRIDES.get(employee.email.trim().toLowerCase()) ||
      employee.passwordHash ||
      employee.clientAdmin.passwordHash;
    if (!comparePassword(currentPassword, currentHash)) {
      const error = new Error('The current password entered is incorrect.');
      error.statusCode = 400;
      throw error;
    }

    const passwordHash = hashPassword(newPassword);
    await prisma.companyEmployee.update({
      where: { id: employee.id },
      data: { passwordHash },
    });
    PASSWORD_OVERRIDES.set(employee.email.trim().toLowerCase(), passwordHash);

    await auditService.logAudit({
      action: 'UPDATE_PASSWORD',
      entityType: 'COMPANY_EMPLOYEE',
      entityId: employee.id,
      reason: `Employee password updated for "${employee.name}"`,
      ipAddress: meta.ip || '127.0.0.1',
      userAgent: meta.userAgent || null,
    });

    return { success: true, message: 'Password updated successfully.' };
  },

  async updateCompanyAdminCompany(userPayload, { organizationName, mobile } = {}, meta = {}) {
    if (userPayload?.role !== 'COMPANY_ADMIN' || !userPayload.companyId) {
      const error = new Error('Access denied: Company Admin privileges required.');
      error.statusCode = 403;
      throw error;
    }

    const cleanOrganizationName = typeof organizationName === 'string' ? organizationName.trim() : '';
    if (cleanOrganizationName.length < 2 || cleanOrganizationName.length > 180) {
      const error = new Error('Company name must be between 2 and 180 characters.');
      error.statusCode = 400;
      throw error;
    }

    let cleanMobile = mobile == null ? '' : String(mobile).trim().replace(/[\s\-+]/g, '');
    if (cleanMobile.startsWith('91') && cleanMobile.length === 12) cleanMobile = cleanMobile.slice(2);
    if (cleanMobile && !/^[6-9]\d{9}$/.test(cleanMobile)) {
      const error = new Error('Mobile number must be 10 digits and start with 6, 7, 8, or 9.');
      error.statusCode = 400;
      throw error;
    }

    const companyId = String(userPayload.companyId);
    const existing = await prisma.clientAdmin.findUnique({ where: { id: companyId } });
    if (!existing || existing.deletedAt || existing.status !== 'ACTIVE') {
      const error = new Error('Active company admin account not found.');
      error.statusCode = 404;
      throw error;
    }

    const updated = await prisma.clientAdmin.update({
      where: { id: companyId },
      data: {
        organizationName: cleanOrganizationName,
        mobile: cleanMobile || null,
      },
    });

    await auditService.logAudit({
      action: 'UPDATE',
      entityType: 'CLIENT_ADMIN',
      entityId: updated.id,
      oldValue: { organizationName: existing.organizationName, mobile: existing.mobile },
      newValue: { organizationName: updated.organizationName, mobile: updated.mobile },
      reason: `Company profile updated by its admin`,
      ipAddress: meta.ip || '127.0.0.1',
      userAgent: meta.userAgent || null,
    });

    return {
      success: true,
      message: 'Company profile updated successfully.',
      data: {
        organizationName: updated.organizationName,
        mobile: updated.mobile,
      },
    };
  },
};

export default authService;
