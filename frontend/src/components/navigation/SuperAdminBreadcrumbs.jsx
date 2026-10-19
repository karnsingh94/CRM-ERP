'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { getSuperAdminBreadcrumbs } from '../../config/routes.config';

/**
 * Super Admin Global Breadcrumb Navigation Component
 * Dynamically resolves hierarchy from current URL and route metadata.
 * Renders semantic, accessible HTML with clickable parent links.
 */
export default function SuperAdminBreadcrumbs({ selectedService = null }) {
  const pathname = usePathname() || '/dashboard';
  
  const crumbs = getSuperAdminBreadcrumbs(pathname, {
    serviceName: selectedService?.name,
  });

  return (
    <nav
      aria-label="Breadcrumb"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.45rem',
        fontSize: '0.86rem',
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
        }}
      >
        {crumbs.map((crumb, idx) => {
          const isLast = idx === crumbs.length - 1;

          return (
            <li
              key={`${crumb.path}-${idx}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.45rem',
              }}
            >
              {idx > 0 && (
                <span
                  style={{
                    color: '#94a3b8',
                    fontSize: '0.85rem',
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
                  style={{
                    fontWeight: 800,
                    color: '#0f172a',
                    letterSpacing: '-0.2px',
                  }}
                >
                  {crumb.label}
                </span>
              ) : (
                <Link
                  href={crumb.path}
                  style={{
                    color: '#64748b',
                    fontWeight: 600,
                    textDecoration: 'none',
                    transition: 'color 0.15s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = '#7f22fe';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = '#64748b';
                  }}
                >
                  {crumb.label}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
