import jwt from 'jsonwebtoken';

if (!process.env.JWT_SECRET && process.env.NODE_ENV === 'production') {
  throw new Error('JWT_SECRET must be set in production');
}
export const JWT_SECRET = process.env.JWT_SECRET || 'syncpay_dev_secret';

export function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }
  try {
    const user = jwt.verify(authHeader.split(' ')[1], JWT_SECRET);
    if (user.purpose) throw new Error('not a session token'); // OTP tokens can't be used as sessions
    req.user = user;
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// Short-lived proof that `phone` passed OTP verification. Required by register and login.
export const signOtpToken = (phone) => jwt.sign({ phone, purpose: 'otp' }, JWT_SECRET, { expiresIn: '10m' });

export function isValidOtpToken(otpToken, phone) {
  try {
    const t = jwt.verify(otpToken, JWT_SECRET);
    return t.purpose === 'otp' && t.phone === phone;
  } catch {
    return false;
  }
}
