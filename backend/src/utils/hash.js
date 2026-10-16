import bcrypt from 'bcryptjs';

/**
 * Hash password securely with standard salt factor
 */
export function hashPassword(plainPassword) {
  const salt = bcrypt.genSaltSync(10);
  return bcrypt.hashSync(plainPassword, salt);
}

/**
 * Compare plain password against hash
 */
export function comparePassword(plainPassword, hash) {
  return bcrypt.compareSync(plainPassword, hash);
}

export default { hashPassword, comparePassword };
