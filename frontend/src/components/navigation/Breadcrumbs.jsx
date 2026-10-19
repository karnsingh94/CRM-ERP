'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { getCompanyAdminBreadcrumbs } from '../../config/routes.config';
import styles from '../company-admin/CompanyAdminPortal.module.css';

/**
 * Company Admin Global Breadcrumb Navigation Component
 * Dynamically resolves hierarchy: Company > Service > Module > Screen
 * Renders semantic, accessible HTML with clickable parent links.
 * Never hardcodes company name.
 */
export default function CompanyAdminBreadcrumbs({ activeCompany = null }) {
  const pathname = usePathname() || '/dashboard';
  const companyName = activeCompany?.organizationName || 'Company Workspace';

  const crumbs = getCompanyAdminBreadcrumbs(pathname, companyName);

  return (
    <nav
      aria-label="Breadcrumb"
      className={styles.breadcrumbs}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.45rem',
        fontSize: '0.85rem',
      }}
    >
      <ol
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.45rem',
          listStyle: 'none',
          padding: 0,
          margin: 0,
          flexWrap: 'wrap',
        }}
      >
        {crumbs.map((crumb, idx) => {
          const isLast = idx === crumbs.length - 1;

          return (
            <li
              key={`${crumb.label}-${idx}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.45rem',
              }}
            >
              {idx > 0 && (
                <span
                  style={{
                    color: '#cbd5e1',
                    fontSize: '0.82rem',
                    userSelect: 'none',
                  }}
                  aria-hidden="true"
                >
                  /
                </span>
              )}

              {isLast ? (
                <span
                  aria-current="page"
                  className={styles.breadcrumbCurrent}
                  style={{
                    fontWeight: 800,
                    color: '#0f172a',
                    letterSpacing: '-0.2px',
                  }}
                >
                  {crumb.label}
                </span>
              ) : crumb.path ? (
                <Link
                  href={crumb.path}
                  className={styles.breadcrumbLink}
                  style={{
                    color: idx === 0 ? '#475569' : '#64748b',
                    fontWeight: 700,
                    textDecoration: 'none',
                    transition: 'color 0.15s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = '#7f22fe';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = idx === 0 ? '#475569' : '#64748b';
                  }}
                >
                  {crumb.label}
                </Link>
              ) : (
                <span
                  style={{
                    color: '#64748b',
                    fontWeight: 600,
                  }}
                >
                  {crumb.label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
