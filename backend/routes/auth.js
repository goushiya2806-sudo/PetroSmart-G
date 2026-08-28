import express from 'express';
import rateLimit from 'express-rate-limit';
import { register, verifyOTP, resendOTP } from '../controllers/registerController.js';
import { login, selectPump, logout } from '../controllers/loginController.js';
import { forgotPassword, resetPassword } from '../controllers/passwordController.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// Rate limiters
const loginLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10,
  message: { error: 'Too many login attempts from this IP. Try again in an hour.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: { error: 'Too many registration attempts from this IP. Try again in an hour.' },
});

const otpLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: { error: 'Too many OTP requests from this IP. Try again in an hour.' },
});

// Registration
router.post('/register',     registerLimiter, register);
router.post('/verify-otp',   otpLimiter,      verifyOTP);
router.post('/resend-otp',   otpLimiter,      resendOTP);

// Login
router.post('/login',        loginLimiter,    login);
router.post('/select-pump',  loginLimiter,    selectPump);
router.post('/logout',       authenticate,    logout);

// Password reset
router.post('/forgot-password', otpLimiter,  forgotPassword);
router.post('/reset-password',  otpLimiter,  resetPassword);

export default router;