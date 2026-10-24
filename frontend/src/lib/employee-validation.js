const EMPLOYEE_NAME_PATTERN = /^[\p{L}\p{M}][\p{L}\p{M}\s.'’-]*$/u;
const EMPLOYEE_DESIGNATION_PATTERN = /^[\p{L}\p{M}\p{N}\s&.,'’()/+-]*$/u;

function isValidWorkEmail(value) {
  if (value.length > 254) return false;

  const parts = value.split('@');
  if (parts.length !== 2) return false;

  const [localPart, domain] = parts;
  if (
    !localPart ||
    localPart.length > 64 ||
    localPart.startsWith('.') ||
    localPart.endsWith('.') ||
    localPart.includes('..') ||
    !/^[A-Za-z0-9!#$%&'*+/=?^_`{|}~.-]+$/.test(localPart)
  ) {
    return false;
  }

  const labels = domain.split('.');
  if (
    labels.length < 2 ||
    labels.some((label) =>
      !label ||
      label.length > 63 ||
      !/^[\p{L}\p{N}](?:[\p{L}\p{N}-]*[\p{L}\p{N}])?$/u.test(label)
    )
  ) {
    return false;
  }

  const topLevelDomain = labels.at(-1);
  return (
    (topLevelDomain.length >= 2 && /^\p{L}+$/u.test(topLevelDomain)) ||
    /^xn--[a-z0-9-]{2,}$/i.test(topLevelDomain)
  );
}

export function validateEmployeeForm(employee, options = {}) {
  const name = typeof employee.name === 'string' ? employee.name.trim() : '';
  const email = typeof employee.email === 'string' ? employee.email.trim() : '';
  const designation = typeof employee.role === 'string' ? employee.role.trim() : '';
  const password = typeof employee.password === 'string' ? employee.password : '';
  const phone = typeof employee.phone === 'string' ? employee.phone.trim() : '';

  if (!name) return 'Full Name is required.';
  if (name.length < 2) return 'Full Name must be at least 2 characters long.';
  if (name.length > 100 || !EMPLOYEE_NAME_PATTERN.test(name)) {
    return 'Enter a valid name using letters, spaces, apostrophes, periods, or hyphens (up to 100 characters).';
  }
  if (!email || !isValidWorkEmail(email)) {
    return 'Enter a valid work email address.';
  }
  if (options.requirePhone || phone) {
    if (!phone) return 'Mobile / Phone Number is required.';
    if (!/^[6-9]\d{9}$/.test(phone)) {
      return 'Mobile Number must be exactly 10 digits and start with 6, 7, 8, or 9.';
    }
  }
  if (designation.length > 100 || (designation && !EMPLOYEE_DESIGNATION_PATTERN.test(designation))) {
    return 'Enter a valid job designation (up to 100 characters).';
  }
  if (!password) {
    return 'Password is required.';
  }
  if (password.length < 8 || password.length > 128) {
    return 'Password must be between 8 and 128 characters.';
  }
  if (!/[A-Z]/.test(password)) {
    return 'Password must contain at least 1 uppercase letter (A-Z).';
  }
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`]/.test(password)) {
    return 'Password must contain at least 1 special character (!@#$%^&* etc.).';
  }
  if (employee.serviceCode !== undefined && !employee.serviceCode) {
    return 'Select an assigned service.';
  }

  return '';
}
