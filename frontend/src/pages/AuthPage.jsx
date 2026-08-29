// frontend/src/pages/AuthPage.jsx
import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import './AuthPage.css';

const API = '/api/auth';

function sanitize(str) { return str.replace(/[<>"'`]/g, ''); }

// ─── OTP 6-box ────────────────────────────────────────────────────
function OTPInput({ value, onChange }) {
  const refs = [useRef(), useRef(), useRef(), useRef(), useRef(), useRef()];
  const digits = value.split('').concat(Array(6).fill('')).slice(0, 6);
  function handleChange(i, e) {
    const char = e.target.value.replace(/\D/g, '').slice(-1);
    const next = digits.map((d, idx) => (idx === i ? char : d)).join('');
    onChange(next);
    if (char && i < 5) refs[i + 1].current?.focus();
  }
  function handleKey(i, e) {
    if (e.key === 'Backspace') {
      if (digits[i]) { onChange(digits.map((d, idx) => (idx === i ? '' : d)).join('')); }
      else if (i > 0) { refs[i - 1].current?.focus(); onChange(digits.map((d, idx) => (idx === i - 1 ? '' : d)).join('')); }
    }
  }
  function handlePaste(e) {
    const p = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    onChange(p.padEnd(6, '').slice(0, 6));
    refs[Math.min(p.length, 5)].current?.focus();
    e.preventDefault();
  }
  return (
    <div className="ps-otp-row" onPaste={handlePaste}>
      {digits.map((d, i) => (
        <input key={i} ref={refs[i]}
          className={`ps-otp-box${d ? ' filled' : ''}`}
          type="text" inputMode="numeric" maxLength={1} value={d}
          onChange={e => handleChange(i, e)} onKeyDown={e => handleKey(i, e)}
          autoFocus={i === 0} autoComplete="off" />
      ))}
    </div>
  );
}

// ─── Countdown ────────────────────────────────────────────────────
function Countdown({ seconds, onEnd }) {
  const [left, setLeft] = useState(seconds);
  useEffect(() => {
    setLeft(seconds);
    if (seconds <= 0) return;
    const t = setInterval(() => setLeft(p => {
      if (p <= 1) { clearInterval(t); onEnd?.(); return 0; }
      return p - 1;
    }), 1000);
    return () => clearInterval(t);
  }, [seconds]);
  if (left <= 0) return null;
  const m = Math.floor(left / 60).toString().padStart(2, '0');
  const s = (left % 60).toString().padStart(2, '0');
  return <span className="ps-countdown">{m}:{s}</span>;
}

// ─── Password field with eye ──────────────────────────────────────
function PwField({ label, placeholder, value, onChange, error, autoComplete, id }) {
  const [show, setShow] = useState(false);
  return (
    <div className="ps-field">
      {label && <label className="ps-label" htmlFor={id}>{label}</label>}
      <div className={`ps-input-group${error ? ' ps-input-err' : ''}`}>
        <span className="material-symbols-outlined">lock</span>
        <input id={id} type={show ? 'text' : 'password'} placeholder={placeholder}
          value={value} onChange={onChange} autoComplete={autoComplete || 'current-password'} />
        <span className="material-symbols-outlined ps-eye" onClick={() => setShow(p => !p)}>
          {show ? 'visibility_off' : 'visibility'}
        </span>
      </div>
      {error && <p className="ps-err-msg">{error}</p>}
    </div>
  );
}

// ─── Regular field ────────────────────────────────────────────────
function Field({ label, icon, type = 'text', placeholder, value, onChange, error, autoComplete, id, hint }) {
  return (
    <div className="ps-field">
      {label && <label className="ps-label" htmlFor={id}>{label}</label>}
      <div className={`ps-input-group${error ? ' ps-input-err' : ''}`}>
        <span className="material-symbols-outlined">{icon}</span>
        <input id={id} type={type} placeholder={placeholder}
          value={value} onChange={onChange} autoComplete={autoComplete} />
      </div>
      {error && <p className="ps-err-msg">{error}</p>}
      {hint && !error && <p className="ps-hint-msg">{hint}</p>}
    </div>
  );
}

// ─── Toast ────────────────────────────────────────────────────────
function Toast({ msg, type, onClose }) {
  useEffect(() => { if (!msg) return; const t = setTimeout(onClose, 4500); return () => clearTimeout(t); }, [msg]);
  if (!msg) return null;
  const icons = { success: 'check_circle', error: 'cancel', warn: 'warning' };
  return (
    <div className={`ps-toast ps-toast-${type}`}>
      <span className="material-symbols-outlined">{icons[type] || 'info'}</span>
      <span className="ps-toast-msg">{msg}</span>
      <button className="ps-toast-x" onClick={onClose}>
        <span className="material-symbols-outlined">close</span>
      </button>
    </div>
  );
}

// ─── MAIN ─────────────────────────────────────────────────────────
export default function AuthPage() {
  const navigate = useNavigate();

  useEffect(() => {
    document.body.classList.add('auth-page-active');
    return () => document.body.classList.remove('auth-page-active');
  }, []);

  const [tab,      setTab]      = useState('login');   // 'login' | 'register'
  const [view,     setView]     = useState('main');    // 'main' | 'otp' | 'forgot' | 'reset_otp' | 'reset_pw' | 'pump_select'
  const [loading,  setLoading]  = useState(false);
  const [toast,    setToast]    = useState({ msg: '', type: '' });
  const [errors,   setErrors]   = useState({});

  // OTP
  const [userId,    setUserId]    = useState('');
  const [otp,       setOtp]       = useState('');
  const [otpEmail,  setOtpEmail]  = useState('');
  const [canResend, setCanResend] = useState(false);
  const [timerKey,  setTimerKey]  = useState(0);

  const [reg, setReg] = useState({ full_name: '', email: '', username: '', password: '' });
  const [lgn, setLgn] = useState({ identifier: '', password: '', remember_me: false });

  // Pump selection (multi-pump login)
  const [tempToken,   setTempToken]   = useState('');
  const [pumpOptions, setPumpOptions] = useState([]);

  const [forgotEmail, setForgotEmail] = useState('');
  const [newPw,       setNewPw]       = useState('');
  const [confirmPw,   setConfirmPw]   = useState('');

  function toast_(msg, type = 'success') { setToast({ msg, type }); }
  function clearToast() { setToast({ msg: '', type: '' }); }
  function goView(v)    { setView(v); setErrors({}); clearToast(); }
  function switchTab(t) { setTab(t); setErrors({}); clearToast(); }

  function validateReg() {
    const e = {};
    if (!reg.full_name.trim())        e.full_name = 'Full name is required';
    if (!reg.email.trim())            e.email = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(reg.email)) e.email = 'Enter a valid email';
    if (!reg.username.trim())         e.username = 'Username is required';
    else if (reg.username.length < 3) e.username = 'Minimum 3 characters';
    else if (!/^[a-zA-Z0-9_]+$/.test(reg.username)) e.username = 'Letters, numbers and underscores only';
    if (!reg.password)                e.password = 'Password is required';
    else if (reg.password.length < 8) e.password = 'Minimum 8 characters';
    else if (!/[a-zA-Z]/.test(reg.password) || !/[0-9]/.test(reg.password))
      e.password = 'Must include both letters and numbers';
    return e;
  }

  async function handleRegister(e) {
    e.preventDefault();
    const errs = validateReg();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setLoading(true);
    try {
      const r = await fetch(`${API}/register`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...reg, email: sanitize(reg.email), username: sanitize(reg.username) }),
      });
      const data = await r.json();
      if (!r.ok) throw data;
      setUserId(data.user_id);
      setOtpEmail(forgotEmail);
      setOtp('');
      setCanResend(false);
      setTimerKey(k => k + 1);
      toast_('OTP sent to your email!');
      goView('otp');
    } catch (err) {
      if (err.errors) setErrors(err.errors);
      else toast_(err.error || 'Registration failed', 'error');
    } finally { setLoading(false); }
  }

  async function handleLogin(e) {
    e.preventDefault();
    if (!lgn.identifier || !lgn.password) { setErrors({ identifier: 'All fields are required' }); return; }
    setLoading(true);
    try {
      const r = await fetch(`${API}/login`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(lgn),
      });
      const data = await r.json();
      if (!r.ok) {
        if (data.code === 'UNVERIFIED') {
          setUserId(data.user_id); setOtpEmail(lgn.identifier);
          setOtp(''); setCanResend(false); setTimerKey(k => k + 1);
          toast_('Please verify your email first.', 'warn');
          goView('otp'); return;
        }
        throw data;
      }

      // Debug: log exactly what the backend sent, so if this breaks
      // again we see it immediately in the browser console instead
      // of guessing.
      console.log('[LOGIN RESPONSE]', data);

      // Multi-pump accounts don't get a token yet — they get a
      // temp_token + list of pumps, and must pick one first.
      if (data.redirect === 'pump_selection') {
        setTempToken(data.temp_token);
        setPumpOptions(data.pumps || []);
        goView('pump_select');
        return;
      }

      if (!data.token) {
        toast_('Login succeeded but no session token was returned. Check console.', 'error');
        console.error('[LOGIN BUG] data.token is missing. Full response:', data);
        setLoading(false);
        return; // ← stop here, don't store "undefined" or redirect
      }

      const store = lgn.remember_me ? localStorage : sessionStorage;
      store.setItem('token', data.token);
      store.setItem('user', JSON.stringify(data.user));
      toast_('Signed in! Redirecting…');
      setTimeout(() => {
        if (data.redirect === 'setup_wizard') window.location.href = '/setup';
        else window.location.href = '/dashboard';
      }, 600);
    }
     catch (err) {
      toast_(err.error || 'Login failed', 'error');
    } finally { setLoading(false); }
  }

  async function handleSelectPump(pumpId) {
    if (!pumpId) return;
    setLoading(true);
    try {
      const r = await fetch(`${API}/select-pump`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ temp_token: tempToken, pump_id: pumpId, remember_me: lgn.remember_me }),
      });
      const data = await r.json();
      if (!r.ok) throw data;

      if (!data.token) {
        toast_('Pump selected but no session token was returned. Check console.', 'error');
        console.error('[SELECT-PUMP BUG] data.token is missing. Full response:', data);
        return;
      }

      const store = lgn.remember_me ? localStorage : sessionStorage;
      store.setItem('token', data.token);
      store.setItem('user', JSON.stringify(data.user));
      toast_('Signed in! Redirecting…');
      setTimeout(() => { window.location.href = '/dashboard'; }, 600);
    } catch (err) {
      toast_(err.error || 'Could not select pump', 'error');
    } finally { setLoading(false); }
  }

  async function handleVerifyOTP(e) {
    e.preventDefault();
    if (otp.length < 6) { toast_('Enter all 6 digits', 'error'); return; }
    setLoading(true);
    try {
      const r = await fetch(`${API}/verify-otp`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, otp }),
      });
      const data = await r.json();
      if (!r.ok) throw data;
      toast_('Email verified! Please sign in.');
      setTimeout(() => { switchTab('login'); goView('main'); }, 1200);
    } catch (err) {
      toast_(err.error || 'Verification failed', 'error');
    } finally { setLoading(false); }
  }

  async function handleResend() {
    setLoading(true);
    try {
      const r = await fetch(`${API}/resend-otp`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId }),
      });
      const data = await r.json();
      if (!r.ok) throw data;
      toast_('New OTP sent!');
      setOtp(''); setCanResend(false); setTimerKey(k => k + 1);
    } catch (err) {
      toast_(err.error || 'Resend failed', 'error');
    } finally { setLoading(false); }
  }

 async function handleForgot(e) {
  e.preventDefault();
  if (!forgotEmail) { setErrors({ forgotEmail: 'Email is required' }); return; }
  setLoading(true);
  try {
    const r = await fetch(`${API}/forgot-password`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: forgotEmail }),
    });
    const data = await r.json();
    if (!r.ok) throw data;
    setUserId(data.user_id);
    setOtpEmail(forgotEmail);
    setOtp(''); setCanResend(false); setTimerKey(k => k + 1);
    toast_('Reset code sent!');
    goView('reset_otp');
  } catch (err) {
    toast_(err.error || 'Failed to send reset code', 'error');
  } finally { setLoading(false); }
}

  async function handleResetPw(e) {
    e.preventDefault();
    const errs = {};
    if (!newPw || newPw.length < 8) errs.newPw = 'Minimum 8 characters';
    if (newPw !== confirmPw)        errs.confirmPw = 'Passwords do not match';
    if (Object.keys(errs).length)  { setErrors(errs); return; }
    setLoading(true);
    try {
      const r = await fetch(`${API}/reset-password`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, otp, new_password: newPw }),
      });
      const data = await r.json();
      if (!r.ok) throw data;
      toast_('Password reset! Please sign in.');
      setTimeout(() => { goView('main'); switchTab('login'); }, 1500);
    } catch (err) {
      toast_(err.error || 'Reset failed', 'error');
    } finally { setLoading(false); }
  }

  const isSpecial = view !== 'main';

  return (
    <div className="ps-page">

      {/* ══ LEFT HERO ══════════════════════════════════════════ */}
      <div className="ps-hero">
        <div className="ps-hero-overlay" />
        <div className="ps-hero-body">
          <div className="ps-hero-logo">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="M3 7h4l2-4h6l2 4h4v14H3z"/>
              <path d="M12 11v6M9 14h6"/>
            </svg>
            PetroSmart
          </div>
          <h1 className="ps-hero-title">
            Petrol Bunk<br /><span>Management</span>
          </h1>
          <p className="ps-hero-sub">
            Streamlined operations for the modern energy provider.
          </p>
          <div className="ps-hero-badges">
            <span className="ps-badge">⚡ Real-Time Sales</span>
            <span className="ps-badge">📊 Shift Reports</span>
            <span className="ps-badge">🔐 Secure RBAC</span>
            <span className="ps-badge">⛽ Multi-Fuel</span>
          </div>
        </div>
      </div>

      {/* ══ RIGHT AUTH PANEL ═══════════════════════════════════ */}
      <div className="ps-auth">

        {/* ── SPECIAL VIEWS overlay ── */}
        {isSpecial && (
          <div className="ps-special-view">

            {view === 'otp' && (
              <div className="ps-inner">
                <div className="ps-otp-icon-wrap">
                  <span className="material-symbols-outlined">mark_email_read</span>
                </div>
                <h2 className="ps-inner-title">Verify your email</h2>
                <p className="ps-sub">We sent a 6-digit code to<br /><strong>{otpEmail}</strong></p>

                <OTPInput value={otp} onChange={setOtp} />

                {/* Timer — visible while countdown active */}
                {!canResend && (
                  <div className="ps-otp-timer-row">
                    <span className="material-symbols-outlined">schedule</span>
                    <span>Code expires in</span>
                    <Countdown key={timerKey} seconds={600} onEnd={() => setCanResend(true)} />
                  </div>
                )}

                {/* Expired state — prominent resend */}
                {canResend && (
                  <>
                    <div className="ps-otp-expired-box">
                      <span className="material-symbols-outlined">warning</span>
                      <span>Your OTP has expired</span>
                    </div>
                    <button className="ps-resend-prominent" disabled={loading} onClick={handleResend}>
                      {loading
                        ? <><span className="ps-spin" />Sending…</>
                        : <><span className="material-symbols-outlined">refresh</span>Resend OTP</>}
                    </button>
                  </>
                )}

                {!canResend && (
                  <>
                    <div className="ps-otp-warn">
                      ⏰ Unverified accounts are deleted after <strong>24 hours</strong>
                    </div>
                    <button className="ps-btn" onClick={handleVerifyOTP}
                      disabled={loading || otp.replace(/\s/g, '').length < 6}>
                      {loading ? <><span className="ps-spin" />Verifying…</> : 'Verify & Create Account'}
                    </button>
                  </>
                )}
                <button className="ps-back-link" onClick={() => goView('main')}>← Go back</button>
              </div>
            )}

            {view === 'pump_select' && (
              <div className="ps-inner">
                <div className="ps-otp-icon-wrap">
                  <span className="material-symbols-outlined">local_gas_station</span>
                </div>
                <h2 className="ps-inner-title">Select a station</h2>
                <p className="ps-sub">Your account has access to multiple stations.<br />Choose which one to sign in to.</p>

                <div className="ps-pump-list">
                  {pumpOptions.map(p => {
                    const pumpId = p.id || p.pump_id;
                    const pumpName = p.name || p.pump_name;
                    return (
                      <button key={pumpId} className="ps-btn"
                        disabled={loading}
                        onClick={() => handleSelectPump(pumpId)}
                        style={{ marginBottom: 10 }}>
                        {loading ? <><span className="ps-spin" />Signing in…</> : pumpName}
                      </button>
                    );
                  })}
                </div>

                <button className="ps-back-link" onClick={() => goView('main')}>← Back to Sign In</button>
              </div>
            )}

            {view === 'forgot' && (
              <div className="ps-inner">
                <button className="ps-back-link" style={{ textAlign: 'left', marginBottom: 20 }}
                  onClick={() => goView('main')}>← Back to Sign In</button>
                <h2 className="ps-inner-title">Reset password</h2>
                <p className="ps-sub" style={{ textAlign: 'left', marginBottom: 20 }}>
                  Enter your registered email and we'll send a reset code.
                </p>
                <Field id="forgotemail" icon="mail" type="email" label="Email address"
                  placeholder="your@email.com" value={forgotEmail}
                  onChange={e => setForgotEmail(e.target.value)} error={errors.forgotEmail} />
                <button className="ps-btn" onClick={handleForgot} disabled={loading}>
                  {loading ? <><span className="ps-spin" />Sending…</> : 'Send Reset Code'}
                </button>
              </div>
            )}

            {view === 'reset_otp' && (
              <div className="ps-inner">
                <div className="ps-otp-icon-wrap">
                  <span className="material-symbols-outlined">key</span>
                </div>
                <h2 className="ps-inner-title">Enter reset code</h2>
                <p className="ps-sub">6-digit code sent to<br /><strong>{otpEmail}</strong></p>
                <OTPInput value={otp} onChange={setOtp} />
                {!canResend ? (
                  <div className="ps-otp-timer-row">
                    <span className="material-symbols-outlined">schedule</span>
                    <span>Expires in</span>
                    <Countdown key={timerKey} seconds={600} onEnd={() => setCanResend(true)} />
                  </div>
                ) : (
                  <>
                    <div className="ps-otp-expired-box">
                      <span className="material-symbols-outlined">warning</span>
                      <span>Code expired — request a new one</span>
                    </div>
                    <button className="ps-resend-prominent" disabled={loading} onClick={handleForgot}>
                      <span className="material-symbols-outlined">refresh</span>Resend Reset Code
                    </button>
                  </>
                )}
                {!canResend && (
                  <button className="ps-btn" disabled={otp.replace(/\s/g, '').length < 6}
                    onClick={() => { if (otp.length >= 6) goView('reset_pw'); }}>
                    Continue
                  </button>
                )}
              </div>
            )}

            {view === 'reset_pw' && (
              <div className="ps-inner">
                <h2 className="ps-inner-title">New password</h2>
                <p className="ps-sub" style={{ textAlign: 'left', marginBottom: 20 }}>
                  Choose a strong password. Cannot reuse your last 5 passwords.
                </p>
                <PwField id="newpw" label="New Password"
                  placeholder="Min 8 chars, letters + numbers"
                  value={newPw} autoComplete="new-password"
                  onChange={e => setNewPw(e.target.value)} error={errors.newPw} />
                <PwField id="confirmpw" label="Confirm Password"
                  placeholder="Re-enter new password"
                  value={confirmPw} autoComplete="new-password"
                  onChange={e => setConfirmPw(e.target.value)} error={errors.confirmPw} />
                <button className="ps-btn" onClick={handleResetPw} disabled={loading}>
                  {loading ? <><span className="ps-spin" />Resetting…</> : 'Reset Password'}
                </button>
              </div>
            )}

          </div>
        )}

        {/* ── MAIN PANEL — tabs + forms ── */}
        {!isSpecial && (
          <div className="ps-panel">

            {/* Tab Bar */}
            <div className="ps-tab-bar">
              <button className={`ps-tab${tab === 'login' ? ' ps-tab-active' : ''}`}
                onClick={() => switchTab('login')}>
                Sign In
              </button>
              <button className={`ps-tab${tab === 'register' ? ' ps-tab-active' : ''}`}
                onClick={() => switchTab('register')}>
                Register
              </button>
              <div className={`ps-tab-slider${tab === 'register' ? ' right' : ''}`} />
            </div>

            {/* LOGIN */}
            {tab === 'login' && (
              <div className="ps-form-body">
                <h2 className="ps-form-title">Administrator Login</h2>
                <p className="ps-form-sub">Sign in to manage your petrol station</p>
                <form onSubmit={handleLogin} noValidate>
                  <Field id="identifier" icon="person" label="Station ID or Email"
                    placeholder="Enter your ID or email"
                    value={lgn.identifier} autoComplete="username"
                    onChange={e => setLgn(p => ({ ...p, identifier: e.target.value }))}
                    error={errors.identifier} />
                  <PwField id="loginpw" label="Password" placeholder="Enter your password"
                    value={lgn.password} autoComplete="current-password"
                    onChange={e => setLgn(p => ({ ...p, password: e.target.value }))}
                    error={errors.password} />
                  <div className="ps-row-between">
                    <label className="ps-check-label">
                      <input type="checkbox" checked={lgn.remember_me}
                        onChange={e => setLgn(p => ({ ...p, remember_me: e.target.checked }))} />
                      Remember me
                    </label>
                    <button type="button" className="ps-link-btn"
                      onClick={() => goView('forgot')}>Forgot password?</button>
                  </div>
                  <button type="submit" className="ps-btn" disabled={loading}>
                    {loading ? <><span className="ps-spin" />Signing in…</> : 'Sign In'}
                  </button>
                </form>
                <p className="ps-switch-text">
                  Don't have an account?{' '}
                  <button type="button" className="ps-link-btn bold"
                    onClick={() => switchTab('register')}>Register here</button>
                </p>
              </div>
            )}

            {/* REGISTER */}
            {tab === 'register' && (
              <div className="ps-form-body">
                <h2 className="ps-form-title">Create Account</h2>
                <p className="ps-form-sub">Register as a pump owner or operator</p>
                <form onSubmit={handleRegister} noValidate>
                  <Field id="fullname" icon="person" label="Full Name"
                    placeholder="Your full name" value={reg.full_name}
                    autoComplete="name"
                    onChange={e => setReg(p => ({ ...p, full_name: e.target.value }))}
                    error={errors.full_name} />
                  <Field id="regemail" icon="mail" type="email" label="Email"
                    placeholder="your@email.com" value={reg.email}
                    autoComplete="email"
                    onChange={e => setReg(p => ({ ...p, email: e.target.value }))}
                    error={errors.email} />
                  <Field id="username" icon="alternate_email" label="Username"
                    placeholder="e.g. ram_station1" value={reg.username}
                    autoComplete="username"
                    onChange={e => setReg(p => ({ ...p, username: e.target.value }))}
                    error={errors.username}
                    hint="Min 3 chars · letters, numbers, underscores only" />
                  <PwField id="regpw" label="Password"
                    placeholder="Min 8 chars with letters + numbers"
                    value={reg.password} autoComplete="new-password"
                    onChange={e => setReg(p => ({ ...p, password: e.target.value }))}
                    error={errors.password} />
                  <button type="submit" className="ps-btn" disabled={loading}>
                    {loading ? <><span className="ps-spin" />Sending OTP…</> : 'Create Account'}
                  </button>
                </form>
                <p className="ps-switch-text">
                  Already have an account?{' '}
                  <button type="button" className="ps-link-btn bold"
                    onClick={() => switchTab('login')}>Sign in</button>
                </p>
              </div>
            )}

          </div>
        )}

      </div>{/* /ps-auth */}

      <Toast msg={toast.msg} type={toast.type} onClose={clearToast} />
    </div>
  );
}