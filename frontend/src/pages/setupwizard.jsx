// frontend/src/pages/SetupWizard.jsx
// PASTE LOCATION: frontend/src/pages/SetupWizard.jsx  (replace entire file)
//
// CHANGES FROM YOUR ORIGINAL:
//   1. api() — wrapped in try/catch; shows real server errors
//   2. Step1 — logo: Change Photo + Remove Photo buttons
//   3. Step1 — canvas compression (max 600px, JPEG 80%)
//   4. Step1 — drag-and-drop on upload zone
//   5. Step1 — shows logo_note from backend if base64 was stripped
//   All other steps (2–5) are identical to your original.

import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import './SetupWizard.css';

// ── API helper ────────────────────────────────────────────────────
const BASE = '/api';

async function api(path, method = 'GET', body) {
  const token = sessionStorage.getItem('token') || localStorage.getItem('token');

  let res;
  try {
    res = await fetch(BASE + path, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (networkErr) {
    console.error(`[API] Network error ${method} ${path}:`, networkErr);
    throw { status: 0, data: { error: 'Cannot reach server. Is the backend running?' } };
  }

  let data;
  try {
    data = await res.json();
  } catch {
    console.error(`[API] Non-JSON response ${method} ${path} — status ${res.status}`);
    throw { status: res.status, data: { error: `Server error (${res.status}). Check backend logs.` } };
  }

  if (!res.ok) {
    console.error(`[API] ${method} ${path} →`, res.status, data);
    throw { status: res.status, data };
  }
  return data;
}

// ── Constants ─────────────────────────────────────────────────────
const STEPS = [
  { id: 1, label: 'Basic Details',    icon: 'store' },
  { id: 2, label: 'Fuel Types',       icon: 'local_gas_station' },
  { id: 3, label: 'Tanks',            icon: 'storage' },
  { id: 4, label: 'Pumps & Nozzles',  icon: 'settings_input_component' },
  { id: 5, label: 'Operations',       icon: 'tune' },
];

const INDIAN_STATES = [
  'Andhra Pradesh','Arunachal Pradesh','Assam','Bihar','Chhattisgarh',
  'Goa','Gujarat','Haryana','Himachal Pradesh','Jharkhand','Karnataka',
  'Kerala','Madhya Pradesh','Maharashtra','Manipur','Meghalaya','Mizoram',
  'Nagaland','Odisha','Punjab','Rajasthan','Sikkim','Tamil Nadu','Telangana',
  'Tripura','Uttar Pradesh','Uttarakhand','West Bengal',
  'Andaman and Nicobar Islands','Chandigarh',
  'Dadra and Nagar Haveli and Daman and Diu','Delhi',
  'Jammu and Kashmir','Ladakh','Lakshadweep','Puducherry',
];
const VALID_OMC   = ['Indian Oil (IOCL)','Bharat Petroleum (BPCL)','Hindustan Petroleum (HPCL)','Reliance Petroleum','Shell','Essar Oil','Other'];
const PAY_MODES   = [{ id:'cash',label:'Cash',icon:'payments'},{ id:'upi',label:'UPI',icon:'qr_code_2'},{ id:'card',label:'Card',icon:'credit_card'},{ id:'credit',label:'Credit',icon:'account_balance_wallet'}];
const FUEL_ICONS  = ['ev_station','oil_barrel','gas_meter','bolt','local_fire_department'];
const SHIFT_ICONS = ['light_mode','wb_twilight','dark_mode','schedule','wb_sunny'];
const DEF_SHIFTS  = [
  { shift_name:'Morning Shift', icon:'light_mode',  start_time:'06:00', end_time:'14:00' },
  { shift_name:'Evening Shift', icon:'wb_twilight', start_time:'14:00', end_time:'22:00' },
  { shift_name:'Night Shift',   icon:'dark_mode',   start_time:'22:00', end_time:'06:00' },
];

// ── Shared mini components ────────────────────────────────────────
const Err = ({ msg }) => msg ? <p className="sw-err">{msg}</p> : null;

function Spinner({ size = 20 }) {
  return <span className="sw-spin" style={{ width: size, height: size }} />;
}

function Toast({ msg, type, onClose }) {
  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(onClose, 4500);
    return () => clearTimeout(t);
  }, [msg]);
  if (!msg) return null;
  return (
    <div className={`sw-toast sw-toast-${type}`}>
      <span className="material-symbols-outlined">
        {type === 'success' ? 'check_circle' : 'error'}
      </span>
      <span>{msg}</span>
      <button onClick={onClose}>×</button>
    </div>
  );
}

function Stepper({ current, progress }) {
  const pct = progress?.progress_pct ?? Math.round(((current - 1) / 5) * 100);
  return (
    <div className="sw-stepper">
      <div className="sw-step-row">
        {STEPS.map((s, i) => {
          const done   = s.id < current || !!progress?.[`step${s.id}_complete`];
          const active = s.id === current;
          return (
            <div key={s.id} className="sw-step-item">
              {i > 0 && <div className={`sw-step-line ${done ? 'sw-step-line-done' : ''}`} />}
              <div className={`sw-step-dot ${done ? 'sw-dot-done' : active ? 'sw-dot-active' : ''}`}>
                {done
                  ? <span className="material-symbols-outlined" style={{ fontSize: 16 }}>check</span>
                  : <span className="material-symbols-outlined" style={{ fontSize: 16 }}>{s.icon}</span>
                }
              </div>
              <span className={`sw-step-label ${active ? 'sw-label-active' : done ? 'sw-label-done' : ''}`}>
                {s.label}
              </span>
            </div>
          );
        })}
      </div>
      <div className="sw-bar-track">
        <div className="sw-bar-fill" style={{ width: `${pct}%` }} />
      </div>
      <div className="sw-bar-meta">
        <span>Step {current} of 5 — {STEPS[current - 1].label}</span>
        <span className="sw-pct">{pct}% Complete</span>
      </div>
    </div>
  );
}

function NavBar({ step, loading, onBack, onSave }) {
  return (
    <div className="sw-nav">
      <button className="sw-btn-back" onClick={onBack} disabled={loading}>
        <span className="material-symbols-outlined">arrow_back</span>
        {step === 1 ? 'Exit' : 'Back'}
      </button>
      <button className="sw-btn-save" onClick={onSave} disabled={loading}>
        {loading ? <Spinner size={18} /> : (
          <>
            {step === 5 ? 'Complete Setup' : 'Save & Continue'}
            <span className="material-symbols-outlined">
              {step === 5 ? 'check_circle' : 'arrow_forward'}
            </span>
          </>
        )}
      </button>
    </div>
  );
}

function Card({ icon, title, children, action }) {
  return (
    <div className="sw-card">
      <div className="sw-card-head">
        <div className="sw-card-head-left">
          <span className="material-symbols-outlined sw-card-icon">{icon}</span>
          <h3 className="sw-card-title">{title}</h3>
        </div>
        {action && <div>{action}</div>}
      </div>
      <div className="sw-card-body">{children}</div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// STEP 1 — Basic Details (with logo fix)
// ══════════════════════════════════════════════════════════════════
function Step1({ onNext, onBack, toast }) {
  const [form, setForm] = useState({
    pump_name:'', owner_name:'', mobile:'', email:'',
    full_address:'', city:'', state:'', pincode:'',
    gst_number:'', license_number:'', pan:'', tan:'',
    logo_url:'', logo_filename:'', logo_size_bytes: null,
  });
  const [errors,   setErrors]   = useState({});
  const [loading,  setLoading]  = useState(false);
  const [fetching, setFetching] = useState(true);
  // preview holds the data: URI for display; form.logo_url may be
  // null in DB but preview shows it from React state.
  const [preview,  setPreview]  = useState('');
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef(null);

  useEffect(() => {
    api('/wizard/step1')
      .then(({ data }) => {
        if (data) {
          setForm(f => ({ ...f, ...data }));
          // logo_url from DB will be https:// or null;
          // if null, preview stays empty (base64 not persisted in DB)
          if (data.logo_url) setPreview(data.logo_url);
        }
      })
      .catch(err => toast(err.data?.error || 'Failed to load saved data.', 'error'))
      .finally(() => setFetching(false));
  }, []);

  const set = k => e => {
    setForm(f => ({ ...f, [k]: e.target.value }));
    setErrors(er => ({ ...er, [k]: undefined }));
  };

  // ── Canvas compression ────────────────────────────────────────
  function compressImage(file) {
    return new Promise((resolve, reject) => {
      const MAX_SIDE = 600;
      const reader   = new FileReader();
      reader.onerror = () => reject(new Error('File read failed'));
      reader.onload  = ev => {
        const img   = new Image();
        img.onerror = () => reject(new Error('Invalid image'));
        img.onload  = () => {
          let { width, height } = img;
          const ratio = Math.min(MAX_SIDE / width, MAX_SIDE / height, 1);
          width  = Math.round(width  * ratio);
          height = Math.round(height * ratio);
          const canvas = document.createElement('canvas');
          canvas.width  = width;
          canvas.height = height;
          canvas.getContext('2d').drawImage(img, 0, 0, width, height);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.80);
          const bytes   = Math.round((dataUrl.length * 3) / 4);
          resolve({ dataUrl, bytes });
        };
        img.src = ev.target.result;
      };
      reader.readAsDataURL(file);
    });
  }

  const handleLogo = async file => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setErrors(er => ({ ...er, logo: 'Only image files are allowed' }));
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setErrors(er => ({ ...er, logo: 'Image must be under 5 MB' }));
      return;
    }
    setErrors(er => ({ ...er, logo: undefined }));
    try {
      const { dataUrl, bytes } = await compressImage(file);
      setPreview(dataUrl);
      // Store data URI in form for sending to backend.
      // Backend will strip it before DB insert (DB only allows https://).
      setForm(f => ({
        ...f,
        logo_url:        dataUrl,
        logo_filename:   file.name,
        logo_size_bytes: bytes,
      }));
    } catch {
      setErrors(er => ({ ...er, logo: 'Failed to process image. Try another file.' }));
    }
  };

  const handleLogoRemove = () => {
    setPreview('');
    setForm(f => ({ ...f, logo_url: '', logo_filename: '', logo_size_bytes: null }));
    if (fileRef.current) fileRef.current.value = '';
  };

  const onDragOver  = e => { e.preventDefault(); setDragOver(true);  };
  const onDragLeave = () => setDragOver(false);
  const onDrop      = e => {
    e.preventDefault(); setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleLogo(file);
  };

  const save = async () => {
    setLoading(true); setErrors({});
    try {
      const result = await api('/wizard/step1', 'POST', form);
      // Show note if logo was not persisted to DB
      if (result.logo_note) {
        toast('Saved! Note: ' + result.logo_note, 'success');
      } else {
        toast('Step 1 saved! ✓', 'success');
      }
      onNext();
    } catch (err) {
      if (err.data?.errors) setErrors(err.data.errors);
      else toast(err.data?.error || 'Failed to save. Check backend logs.', 'error');
    } finally {
      setLoading(false);
    }
  };

  if (fetching) return <div className="sw-loading"><Spinner size={36} /></div>;

  return (
    <div className="sw-step">
      <div className="sw-step-intro">
        <h2>Basic Pump Details</h2>
        <p>Tell us about your petrol station — name, location and legal info.</p>
      </div>

      <Card icon="badge" title="Pump Identity">
        <div className="sw-grid-2">
          <div className="sw-field">
            <label>Station / Pump Name *</label>
            <input value={form.pump_name} onChange={set('pump_name')}
              placeholder="e.g. Shri Ram Petrol Pump"
              className={errors.pump_name ? 'sw-inp-err' : ''} />
            <Err msg={errors.pump_name} />
          </div>
          <div className="sw-field">
            <label>Owner Name *</label>
            <input value={form.owner_name} onChange={set('owner_name')}
              placeholder="Legal owner name"
              className={errors.owner_name ? 'sw-inp-err' : ''} />
            <Err msg={errors.owner_name} />
          </div>
        </div>
      </Card>

      <Card icon="contact_phone" title="Contact Information">
        <div className="sw-grid-2">
          <div className="sw-field">
            <label>Mobile Number *</label>
            <div className="sw-prefix-wrap">
              <span className="sw-prefix">+91</span>
              <input value={form.mobile} onChange={set('mobile')}
                placeholder="9876543210" maxLength={10}
                className={`sw-prefix-inp ${errors.mobile ? 'sw-inp-err' : ''}`} />
            </div>
            <Err msg={errors.mobile} />
          </div>
          <div className="sw-field">
            <label>Email Address *</label>
            <input type="email" value={form.email} onChange={set('email')}
              placeholder="owner@station.com"
              className={errors.email ? 'sw-inp-err' : ''} />
            <Err msg={errors.email} />
          </div>
        </div>
      </Card>

      <Card icon="location_on" title="Address Details">
        <div className="sw-field">
          <label>Full Address *</label>
          <textarea value={form.full_address} onChange={set('full_address')}
            placeholder="Street, Landmark, Area..." rows={3}
            className={errors.full_address ? 'sw-inp-err' : ''} />
          <Err msg={errors.full_address} />
        </div>
        <div className="sw-grid-3">
          <div className="sw-field">
            <label>City *</label>
            <input value={form.city} onChange={set('city')} placeholder="City"
              className={errors.city ? 'sw-inp-err' : ''} />
            <Err msg={errors.city} />
          </div>
          <div className="sw-field">
            <label>State *</label>
            <select value={form.state} onChange={set('state')}
              className={errors.state ? 'sw-inp-err' : ''}>
              <option value="">Select State</option>
              {INDIAN_STATES.map(s => <option key={s}>{s}</option>)}
            </select>
            <Err msg={errors.state} />
          </div>
          <div className="sw-field">
            <label>Pincode *</label>
            <input value={form.pincode} onChange={set('pincode')}
              placeholder="500001" maxLength={6}
              className={errors.pincode ? 'sw-inp-err' : ''} />
            <Err msg={errors.pincode} />
          </div>
        </div>
      </Card>

      <Card icon="gavel" title="Legal & Compliance">
        <div className="sw-grid-2">
          {[
            { k:'gst_number',     label:'GST Number',     ph:'22AAAAA0000A1Z5' },
            { k:'license_number', label:'License Number', ph:'LNC-12345678'    },
            { k:'pan',            label:'PAN',             ph:'ABCDE1234F'      },
            { k:'tan',            label:'TAN',             ph:'ABCD12345E'      },
          ].map(({ k, label, ph }) => (
            <div className="sw-field" key={k}>
              <label>{label} <span className="sw-hint">(optional)</span></label>
              <input value={form[k]} onChange={set(k)} placeholder={ph}
                style={{ textTransform:'uppercase' }}
                className={errors[k] ? 'sw-inp-err' : ''} />
              <Err msg={errors[k]} />
            </div>
          ))}
        </div>
      </Card>

      <Card icon="add_a_photo" title="Pump Logo / Photo (Optional)">
        {preview ? (
          /* ── Photo is set: show thumbnail + controls ── */
          <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:12 }}>
            <div
              className="sw-logo-thumb-wrap"
              onClick={() => fileRef.current?.click()}
              title="Click to change photo"
            >
              <img
                src={preview} alt="Pump logo"
                style={{
                  width:120, height:120, objectFit:'contain', display:'block',
                  borderRadius:12, border:'2px solid var(--border)',
                }}
              />
              <div className="sw-logo-change-overlay">
                <span className="material-symbols-outlined" style={{ color:'white', fontSize:24 }}>
                  photo_camera
                </span>
                <span style={{ color:'white', fontSize:11, fontWeight:600, marginTop:4 }}>Change</span>
              </div>
            </div>

            <div style={{ display:'flex', gap:10 }}>
              <button type="button" className="sw-btn-back"
                style={{ padding:'6px 14px', fontSize:13 }}
                onClick={() => fileRef.current?.click()}>
                <span className="material-symbols-outlined" style={{ fontSize:16 }}>edit</span>
                Change Photo
              </button>
              <button type="button" className="sw-btn-del-inline"
                onClick={handleLogoRemove}>
                <span className="material-symbols-outlined">delete</span>
                Remove
              </button>
            </div>

            {form.logo_filename && (
              <p className="sw-logo-caption">
                {form.logo_filename}
                {form.logo_size_bytes
                  ? ` · ${(form.logo_size_bytes / 1024).toFixed(0)} KB (compressed)`
                  : ''}
              </p>
            )}
          </div>
        ) : (
          /* ── No photo: show drop zone ── */
          <label
            className={`sw-upload ${dragOver ? 'sw-upload-dragover' : ''}`}
            htmlFor="logo-upload"
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
          >
            <span className="material-symbols-outlined sw-upload-icon">cloud_upload</span>
            <p className="sw-upload-title">
              {dragOver ? 'Drop it here!' : 'Upload Pump Photo or Logo'}
            </p>
            <p className="sw-upload-sub">PNG, JPG, SVG · max 5 MB · auto-compressed</p>
          </label>
        )}

        {/* Shared hidden input — used by zone AND change button */}
        <input
          id="logo-upload"
          ref={fileRef}
          type="file"
          accept="image/*"
          style={{ display:'none' }}
          onChange={e => { handleLogo(e.target.files[0]); e.target.value = ''; }}
        />
        <Err msg={errors.logo} />
      </Card>

      <NavBar step={1} loading={loading} onBack={onBack} onSave={save} />
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// STEP 2 — Fuel Types (unchanged from your original)
// ══════════════════════════════════════════════════════════════════
const FUEL_PRESETS = [
  { fuel_name:'Petrol', short_code:'PET', unit:'litre', current_price:'', opening_stock:'', density_range:'730-770' },
  { fuel_name:'Diesel', short_code:'DSL', unit:'litre', current_price:'', opening_stock:'', density_range:'820-860' },
];

function Step2({ onNext, onBack, toast }) {
  const [fuels,    setFuels]    = useState([{ ...FUEL_PRESETS[0] }]);
  const [errors,   setErrors]   = useState({});
  const [loading,  setLoading]  = useState(false);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    api('/wizard/step2')
      .then(({ data }) => { if (data?.length) setFuels(data); })
      .catch(() => {})
      .finally(() => setFetching(false));
  }, []);

  const addFuel = () => {
    if (fuels.length >= 5) { toast('Maximum 5 fuel types allowed.', 'error'); return; }
    const p = FUEL_PRESETS[fuels.length] || { fuel_name:'', short_code:'', unit:'litre', current_price:'', opening_stock:'', density_range:'' };
    setFuels(f => [...f, { ...p }]);
  };
  const removeFuel = i => {
    if (fuels.length === 1) { toast('At least one fuel type required.', 'error'); return; }
    setFuels(f => f.filter((_, idx) => idx !== i));
    setErrors({});
  };
  const setF = (i, k) => e => {
    setFuels(f => f.map((fuel, idx) => idx === i ? { ...fuel, [k]: e.target.value } : fuel));
    setErrors(er => ({ ...er, [`fuels[${i}].${k}`]: undefined }));
  };

  const save = async () => {
    setLoading(true); setErrors({});
    const payload = fuels.map(f => ({ ...f, short_code: f.short_code?.toUpperCase(), current_price: parseFloat(f.current_price) || 0, opening_stock: parseFloat(f.opening_stock) || 0 }));
    try {
      await api('/wizard/step2', 'POST', { fuels: payload });
      toast('Fuel types saved! ✓', 'success');
      onNext();
    } catch (err) {
      if (err.data?.errors) setErrors(err.data.errors);
      else toast(err.data?.error || 'Failed.', 'error');
    } finally { setLoading(false); }
  };

  if (fetching) return <div className="sw-loading"><Spinner size={36} /></div>;

  return (
    <div className="sw-step">
      <div className="sw-step-intro">
        <h2>Fuel Types</h2>
        <p>Define the fuel products sold at your station (max 5).</p>
      </div>

      {fuels.map((fuel, i) => (
        <div className="sw-card" key={i}>
          <div className="sw-fuel-head">
            <div className="sw-fuel-head-left">
              <span className="material-symbols-outlined sw-card-icon">{FUEL_ICONS[i] || 'local_gas_station'}</span>
              <h3 className="sw-card-title">Fuel Type {i + 1}{fuel.fuel_name ? `: ${fuel.fuel_name}` : ''}</h3>
              {fuel.fuel_name && fuel.current_price > 0 && <span className="sw-badge-done">✓ Configured</span>}
            </div>
            {fuels.length > 1 && (
              <button className="sw-btn-del" onClick={() => removeFuel(i)}>
                <span className="material-symbols-outlined">delete</span>
              </button>
            )}
          </div>
          <div className="sw-card-body">
            <div className="sw-grid-2">
              <div className="sw-field">
                <label>Fuel Name *</label>
                <input value={fuel.fuel_name} onChange={setF(i,'fuel_name')} placeholder="e.g. Petrol" className={errors[`fuels[${i}].fuel_name`] ? 'sw-inp-err' : ''} />
                <Err msg={errors[`fuels[${i}].fuel_name`]} />
              </div>
              <div className="sw-field">
                <label>Short Code * <span className="sw-hint">(1–5 uppercase)</span></label>
                <input value={fuel.short_code} onChange={setF(i,'short_code')} placeholder="PET" maxLength={5} style={{ textTransform:'uppercase' }} className={errors[`fuels[${i}].short_code`] ? 'sw-inp-err' : ''} />
                <Err msg={errors[`fuels[${i}].short_code`]} />
              </div>
              <div className="sw-field">
                <label>Unit *</label>
                <select value={fuel.unit} onChange={setF(i,'unit')} className={errors[`fuels[${i}].unit`] ? 'sw-inp-err' : ''}>
                  <option value="litre">Litre</option>
                  <option value="kg">Kilogram (kg)</option>
                </select>
                <Err msg={errors[`fuels[${i}].unit`]} />
              </div>
              <div className="sw-field">
                <label>Price / {fuel.unit === 'kg' ? 'kg' : 'Ltr'} (₹) *</label>
                <input type="number" min="0" step="0.01" value={fuel.current_price} onChange={setF(i,'current_price')} placeholder="0.00" className={errors[`fuels[${i}].current_price`] ? 'sw-inp-err' : ''} />
                <Err msg={errors[`fuels[${i}].current_price`]} />
              </div>
              <div className="sw-field">
                <label>Opening Stock ({fuel.unit === 'kg' ? 'kg' : 'Ltrs'}) *</label>
                <input type="number" min="0" value={fuel.opening_stock} onChange={setF(i,'opening_stock')} placeholder="0" className={errors[`fuels[${i}].opening_stock`] ? 'sw-inp-err' : ''} />
                <Err msg={errors[`fuels[${i}].opening_stock`]} />
              </div>
              <div className="sw-field">
                <label>Density (kg/m³) <span className="sw-hint">Optional</span></label>
                <input value={fuel.density_range || ''} onChange={setF(i,'density_range')} placeholder="730-770" />
              </div>
            </div>
          </div>
        </div>
      ))}

      {fuels.length < 5 && (
        <button className="sw-btn-add" onClick={addFuel}>
          <span className="material-symbols-outlined">add_circle</span>
          Add Another Fuel Type
        </button>
      )}

      <div className="sw-summary">
        <p className="sw-summary-title">
          <span className="material-symbols-outlined">list_alt</span>Summary
        </p>
        <div className="sw-summary-chips">
          {fuels.map((f, i) => {
            const ok = f.fuel_name && parseFloat(f.current_price) > 0;
            return (
              <div key={i} className={`sw-chip ${ok ? 'sw-chip-ok' : 'sw-chip-pend'}`}>
                <span className={`sw-chip-dot ${ok ? 'sw-dot-ok' : 'sw-dot-pend'}`} />
                <div>
                  <p className="sw-chip-name">{f.fuel_name || `Fuel ${i+1}`} {f.short_code ? `(${f.short_code.toUpperCase()})` : ''}</p>
                  <p className="sw-chip-st">{ok ? 'Configured' : 'Incomplete'}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <NavBar step={2} loading={loading} onBack={onBack} onSave={save} />
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// STEP 3 — Tanks (unchanged from your original)
// ══════════════════════════════════════════════════════════════════
const EMPTY_TANK = { tank_name:'', fuel_type_id:'', shape:'cylindrical', capacity_litres:'', opening_stock:'', min_stock_alert:'' };

function Step3({ onNext, onBack, toast }) {
  const [tanks,    setTanks]    = useState([{ ...EMPTY_TANK }]);
  const [fuels,    setFuels]    = useState([]);
  const [errors,   setErrors]   = useState({});
  const [loading,  setLoading]  = useState(false);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    api('/wizard/step3')
      .then(({ data, fuels: f }) => {
        if (f?.length) setFuels(f);
        if (data?.length) setTanks(data.map(t => ({ ...EMPTY_TANK, ...t })));
      })
      .catch(() => {})
      .finally(() => setFetching(false));
  }, []);

  const addTank    = () => setTanks(t => [...t, { ...EMPTY_TANK }]);
  const removeTank = i  => { if (tanks.length === 1) return; setTanks(t => t.filter((_, idx) => idx !== i)); setErrors({}); };
  const setF = (i, k) => e => { setTanks(t => t.map((tk, idx) => idx === i ? { ...tk, [k]: e.target.value } : tk)); setErrors(er => ({ ...er, [`tanks[${i}].${k}`]: undefined })); };

  const save = async () => {
    setLoading(true); setErrors({});
    const payload = tanks.map(t => ({ ...t, capacity_litres: parseFloat(t.capacity_litres)||0, opening_stock: parseFloat(t.opening_stock)||0, min_stock_alert: parseFloat(t.min_stock_alert)||0 }));
    try {
      await api('/wizard/step3', 'POST', { tanks: payload });
      toast('Tanks saved! ✓', 'success');
      onNext();
    } catch (err) {
      if (err.data?.errors) setErrors(err.data.errors);
      else toast(err.data?.error || 'Failed.', 'error');
    } finally { setLoading(false); }
  };

  if (fetching) return <div className="sw-loading"><Spinner size={36} /></div>;

  return (
    <div className="sw-step">
      <div className="sw-step-intro">
        <h2>Underground Tanks</h2>
        <p>Configure all underground storage tanks at your station.</p>
      </div>

      {tanks.map((tank, i) => {
        const stk = parseFloat(tank.opening_stock);
        const mn  = parseFloat(tank.min_stock_alert);
        const lowWarn = !isNaN(stk) && !isNaN(mn) && mn > 0 && stk < mn;
        return (
          <div className="sw-card" key={i}>
            <div className="sw-fuel-head">
              <div className="sw-fuel-head-left">
                <span className="material-symbols-outlined sw-card-icon">storage</span>
                <h3 className="sw-card-title">Tank #{String(i+1).padStart(2,'0')}</h3>
              </div>
              {tanks.length > 1 && (
                <button className="sw-btn-del" onClick={() => removeTank(i)}>
                  <span className="material-symbols-outlined">delete</span>
                </button>
              )}
            </div>
            <div className="sw-card-body">
              <div className="sw-grid-3">
                <div className="sw-field">
                  <label>Tank Name *</label>
                  <input value={tank.tank_name} onChange={setF(i,'tank_name')} placeholder="e.g. Main Petrol A" className={errors[`tanks[${i}].tank_name`] ? 'sw-inp-err' : ''} />
                  <Err msg={errors[`tanks[${i}].tank_name`]} />
                </div>
                <div className="sw-field">
                  <label>Fuel Type *</label>
                  <select value={tank.fuel_type_id} onChange={setF(i,'fuel_type_id')} className={errors[`tanks[${i}].fuel_type_id`] ? 'sw-inp-err' : ''}>
                    <option value="">Select Fuel</option>
                    {fuels.map(f => <option key={f.id} value={f.id}>{f.fuel_name} ({f.short_code})</option>)}
                  </select>
                  <Err msg={errors[`tanks[${i}].fuel_type_id`]} />
                </div>
                <div className="sw-field">
                  <label>Shape *</label>
                  <select value={tank.shape} onChange={setF(i,'shape')}>
                    <option value="cylindrical">Cylindrical</option>
                    <option value="rectangular">Rectangular</option>
                  </select>
                </div>
                <div className="sw-field">
                  <label>Capacity (L) *</label>
                  <input type="number" min="1" value={tank.capacity_litres} onChange={setF(i,'capacity_litres')} placeholder="15000" className={errors[`tanks[${i}].capacity_litres`] ? 'sw-inp-err' : ''} />
                  <Err msg={errors[`tanks[${i}].capacity_litres`]} />
                </div>
                <div className="sw-field">
                  <label>Opening Stock (L) *</label>
                  <input type="number" min="0" value={tank.opening_stock} onChange={setF(i,'opening_stock')} placeholder="0" className={`${errors[`tanks[${i}].opening_stock`] ? 'sw-inp-err' : ''} ${lowWarn ? 'sw-inp-warn' : ''}`} />
                  <Err msg={errors[`tanks[${i}].opening_stock`]} />
                  {lowWarn && <p className="sw-warn">⚠ Stock below minimum alert level</p>}
                </div>
                <div className="sw-field">
                  <label>Min Stock Alert (L)</label>
                  <input type="number" min="0" value={tank.min_stock_alert} onChange={setF(i,'min_stock_alert')} placeholder="2000" className={errors[`tanks[${i}].min_stock_alert`] ? 'sw-inp-err' : ''} />
                  <Err msg={errors[`tanks[${i}].min_stock_alert`]} />
                </div>
              </div>
            </div>
          </div>
        );
      })}

      <button className="sw-btn-add" onClick={addTank}>
        <span className="material-symbols-outlined">add_circle</span>
        Add Another Tank
      </button>

      <NavBar step={3} loading={loading} onBack={onBack} onSave={save} />
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// STEP 4 — Dispensing Pumps & Nozzles (unchanged from your original)
// ══════════════════════════════════════════════════════════════════
const EMPTY_PUMP = { pump_machine_name:'', serial_number:'', nozzle_count:2, nozzles:[{fuel_type_id:'',tank_id:''},{fuel_type_id:'',tank_id:''}] };

function Step4({ onNext, onBack, toast }) {
  const [pumps,    setPumps]    = useState([JSON.parse(JSON.stringify(EMPTY_PUMP))]);
  const [fuels,    setFuels]    = useState([]);
  const [tanks,    setTanks]    = useState([]);
  const [errors,   setErrors]   = useState({});
  const [loading,  setLoading]  = useState(false);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    api('/wizard/step4')
      .then(({ data, fuels: f, tanks: t }) => {
        if (f?.length) setFuels(f);
        if (t?.length) setTanks(t);
        if (data?.length) {
          setPumps(data.map(p => ({
            pump_machine_name: p.pump_machine_name,
            serial_number:     p.serial_number || '',
            nozzle_count:      p.nozzle_count,
            nozzles:           (p.nozzles||[]).map(n => ({ fuel_type_id: n.fuel_type_id, tank_id: n.tank_id })),
          })));
        }
      })
      .catch(() => {})
      .finally(() => setFetching(false));
  }, []);

  const addPump    = () => setPumps(p => [...p, JSON.parse(JSON.stringify(EMPTY_PUMP))]);
  const removePump = i  => { if (pumps.length === 1) return; setPumps(p => p.filter((_, idx) => idx !== i)); setErrors({}); };

  const setF = (i, k) => e => {
    setPumps(p => p.map((pm, idx) => {
      if (idx !== i) return pm;
      if (k === 'nozzle_count') {
        const n = parseInt(e.target.value);
        return { ...pm, nozzle_count: n, nozzles: Array.from({ length: n }, (_, ni) => pm.nozzles[ni] || { fuel_type_id:'', tank_id:'' }) };
      }
      return { ...pm, [k]: e.target.value };
    }));
    setErrors(er => ({ ...er, [`pumps[${i}].${k}`]: undefined }));
  };

  const setNozzle = (pi, ni, k) => e => {
    setPumps(p => p.map((pm, idx) => {
      if (idx !== pi) return pm;
      return { ...pm, nozzles: pm.nozzles.map((nz, nidx) => nidx === ni ? { ...nz, [k]: e.target.value } : nz) };
    }));
    setErrors(er => ({ ...er, [`pumps[${pi}].nozzles[${ni}].${k}`]: undefined }));
  };

  const tanksFor = fuelId => fuelId ? tanks.filter(t => t.fuel_type_id === fuelId) : tanks;

  const save = async () => {
    setLoading(true); setErrors({});
    try {
      await api('/wizard/step4', 'POST', { pumps });
      toast('Pumps & nozzles saved! ✓', 'success');
      onNext();
    } catch (err) {
      if (err.data?.errors) setErrors(err.data.errors);
      else toast(err.data?.error || 'Failed.', 'error');
    } finally { setLoading(false); }
  };

  if (fetching) return <div className="sw-loading"><Spinner size={36} /></div>;

  return (
    <div className="sw-step">
      <div className="sw-step-intro">
        <h2>Dispensing Pumps & Nozzles</h2>
        <p>Configure each pump machine and map nozzles to fuel tanks.</p>
      </div>

      {pumps.map((pump, pi) => (
        <div className="sw-card" key={pi}>
          <div className="sw-fuel-head">
            <div className="sw-fuel-head-left">
              <span className="material-symbols-outlined sw-card-icon">settings_input_component</span>
              <h3 className="sw-card-title">Pump #{pi + 1}{pump.pump_machine_name ? `: ${pump.pump_machine_name}` : ''}</h3>
            </div>
            {pumps.length > 1 && (
              <button className="sw-btn-del" onClick={() => removePump(pi)}>
                <span className="material-symbols-outlined">delete</span>
              </button>
            )}
          </div>
          <div className="sw-card-body">
            <div className="sw-grid-3">
              <div className="sw-field" style={{ gridColumn:'1/3' }}>
                <label>Pump Machine Name *</label>
                <input value={pump.pump_machine_name} onChange={setF(pi,'pump_machine_name')} placeholder="e.g. Forecourt East 01" className={errors[`pumps[${pi}].pump_machine_name`] ? 'sw-inp-err' : ''} />
                <Err msg={errors[`pumps[${pi}].pump_machine_name`]} />
              </div>
              <div className="sw-field">
                <label>Serial No <span className="sw-hint">Optional</span></label>
                <input value={pump.serial_number} onChange={setF(pi,'serial_number')} placeholder="SN-001" />
              </div>
            </div>

            <div className="sw-field" style={{ marginTop: 8 }}>
              <label>Number of Nozzles *</label>
              <div className="sw-nozzle-count-row">
                {[1,2,3,4].map(n => (
                  <label key={n} className={`sw-count-chip ${pump.nozzle_count === n ? 'sw-count-active' : ''}`}>
                    <input type="radio" name={`nc-${pi}`} value={n} checked={pump.nozzle_count === n} onChange={setF(pi,'nozzle_count')} style={{ display:'none' }} />
                    {n}
                  </label>
                ))}
              </div>
            </div>

            <div className="sw-nozzle-section">
              <p className="sw-nozzle-title">
                <span className="material-symbols-outlined">water_drop</span>
                Nozzle Configuration
              </p>
              {pump.nozzles.map((nz, ni) => (
                <div className="sw-nozzle-row" key={ni}>
                  <div className="sw-nozzle-badge">
                    <span className="sw-nozzle-num">{String(ni+1).padStart(2,'0')}</span>
                    <span className="sw-nozzle-lbl">Nozzle {ni+1}</span>
                  </div>
                  <div className="sw-field sw-nozzle-field">
                    <label>Fuel Type *</label>
                    <select value={nz.fuel_type_id} onChange={setNozzle(pi,ni,'fuel_type_id')} className={errors[`pumps[${pi}].nozzles[${ni}].fuel_type_id`] ? 'sw-inp-err' : ''}>
                      <option value="">Select Fuel</option>
                      {fuels.map(f => <option key={f.id} value={f.id}>{f.fuel_name} ({f.short_code})</option>)}
                    </select>
                    <Err msg={errors[`pumps[${pi}].nozzles[${ni}].fuel_type_id`]} />
                  </div>
                  <div className="sw-field sw-nozzle-field">
                    <label>Source Tank *</label>
                    <select value={nz.tank_id} onChange={setNozzle(pi,ni,'tank_id')} className={errors[`pumps[${pi}].nozzles[${ni}].tank_id`] ? 'sw-inp-err' : ''}>
                      <option value="">Select Tank</option>
                      {tanksFor(nz.fuel_type_id).map(t => <option key={t.id} value={t.id}>{t.tank_name} ({t.fuel_name})</option>)}
                    </select>
                    <Err msg={errors[`pumps[${pi}].nozzles[${ni}].tank_id`]} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ))}

      <button className="sw-btn-add" onClick={addPump}>
        <span className="material-symbols-outlined">add_circle</span>
        Add Another Pump Machine
      </button>

      <NavBar step={4} loading={loading} onBack={onBack} onSave={save} />
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// STEP 5 — Operations (unchanged from your original)
// ══════════════════════════════════════════════════════════════════
// ══════════════════════════════════════════════════════════════════
// STEP 5 — Operational Settings (Enhanced)
// Replace the entire Step5 function in SetupWizard.jsx with this.
// ══════════════════════════════════════════════════════════════════

const PERMISSIONS_LIST = [
  { key: 'sales',          label: 'Sales',           icon: 'point_of_sale' },
  { key: 'inventory',      label: 'Inventory',       icon: 'inventory_2' },
  { key: 'reports',        label: 'Reports',         icon: 'bar_chart' },
  { key: 'pump_control',   label: 'Pump Control',    icon: 'settings_input_component' },
  { key: 'user_management',label: 'User Management', icon: 'manage_accounts' },
];

const ALL_ROLES = ['admin', 'manager', 'accountant'];

function Step5({ onNext, onBack, toast }) {
  // ── Operation ──────────────────────────────────────────────────
  const [opMode,      setOpMode]      = useState('24hours');
  const [shifts,      setShifts]      = useState([{ ...DEF_SHIFTS[0] }]);
  const [payModes,    setPayModes]    = useState(['cash', 'upi']);
  const [omcName,     setOmcName]     = useState('');
  const [dealerCode,  setDealerCode]  = useState('');

  // ── Roles & RBAC ───────────────────────────────────────────────
  const [rbac,        setRbac]        = useState(false);
  const [customRoles, setCustomRoles] = useState([]);
  const [newRoleName, setNewRoleName] = useState('');
  // permissions per role: { roleName: Set<string> }
  const [rolePerms,   setRolePerms]   = useState({});

  // ── Staff Users ────────────────────────────────────────────────
  const [users, setUsers] = useState([{
    full_name: '', username: '', password: '', role: 'attendant', showPw: false
  }]);

  // ── UI state ───────────────────────────────────────────────────
  const [errors,   setErrors]   = useState({});
  const [loading,  setLoading]  = useState(false);
  const [fetching, setFetching] = useState(true);

  // ── Load existing ──────────────────────────────────────────────
  useEffect(() => {
    api('/wizard/step5')
      .then(({ data }) => {
        if (!data) return;
        const os = data.operation_settings;
        if (os) {
          setOpMode(os.operation_mode || '24hours');
          setPayModes(os.payment_modes || ['cash']);
          setOmcName(os.omc_name || '');
          setDealerCode(os.dealer_code || '');
        }
        if (data.shifts?.length)
          setShifts(data.shifts.map(s => ({
            shift_name: s.shift_name, icon: s.icon || 'schedule',
            start_time: s.start_time, end_time: s.end_time,
          })));
        if (typeof data.rbac_enabled !== 'undefined') setRbac(data.rbac_enabled);
        if (data.users?.length)
          setUsers(data.users.map(u => ({ ...u, password: '', showPw: false })));
      })
      .catch(() => {})
      .finally(() => setFetching(false));
  }, []);

  // ── Payment helpers ────────────────────────────────────────────
  const togglePay = m => setPayModes(p =>
    p.includes(m) ? p.filter(x => x !== m) : [...p, m]
  );

  // ── Shift helpers ──────────────────────────────────────────────
  const addShift    = () => setShifts(s => [
    ...s, DEF_SHIFTS[s.length] || { shift_name: '', icon: 'schedule', start_time: '', end_time: '' }
  ]);
  const removeShift = i => setShifts(s => s.filter((_, idx) => idx !== i));
  const setShiftF   = (i, k) => e =>
    setShifts(s => s.map((sh, idx) => idx === i ? { ...sh, [k]: e.target.value } : sh));

  // ── Role helpers ───────────────────────────────────────────────
  const addRole = () => {
    const name = newRoleName.trim();
    if (!name) return;
    if ([...ALL_ROLES, ...customRoles.map(r => r.role_name.toLowerCase())].includes(name.toLowerCase())) {
      toast('Role already exists.', 'error'); return;
    }
    setCustomRoles(r => [...r, { role_name: name }]);
    setRolePerms(p => ({ ...p, [name]: new Set() }));
    setNewRoleName('');
  };
  const removeRole = i => {
    const name = customRoles[i]?.role_name;
    setCustomRoles(r => r.filter((_, idx) => idx !== i));
    setRolePerms(p => { const n = { ...p }; delete n[name]; return n; });
  };
  const togglePerm = (role, perm) => {
    setRolePerms(p => {
      const set = new Set(p[role] || []);
      set.has(perm) ? set.delete(perm) : set.add(perm);
      return { ...p, [role]: set };
    });
  };

  // ── User helpers ───────────────────────────────────────────────
  const addUser = () => setUsers(u => [
    ...u, { full_name: '', username: '', password: '', role: 'attendant', showPw: false }
  ]);
  const removeUser = i => setUsers(u => u.filter((_, idx) => idx !== i));
  const setUserF = (i, k, v) => {
    setUsers(u => u.map((usr, idx) => idx === i ? { ...usr, [k]: v } : usr));
    // clear individual error
    setErrors(e => { const n = { ...e }; delete n[`user_${i}_${k}`]; return n; });
  };

  // ── Validation ─────────────────────────────────────────────────
  function validate() {
    const e = {};
    if (!payModes.length) e.pay = 'Select at least one payment mode';
    if (opMode === 'shift_based') {
      shifts.forEach((sh, i) => {
        if (!sh.shift_name?.trim()) e[`shift_${i}_name`] = 'Shift name required';
        if (!sh.start_time)         e[`shift_${i}_start`] = 'Start time required';
        if (!sh.end_time)           e[`shift_${i}_end`] = 'End time required';
      });
    }
    users.forEach((u, i) => {
      if (!u.full_name?.trim() && !u.username?.trim() && !u.password) return; // skip blank rows
      if (!u.full_name?.trim()) e[`user_${i}_full_name`] = 'Full name required';
      if (!u.username?.trim())  e[`user_${i}_username`]  = 'Username required';
      else if (u.username.length < 3) e[`user_${i}_username`] = 'Min 3 characters';
      else if (!/^[a-zA-Z0-9_]+$/.test(u.username)) e[`user_${i}_username`] = 'Letters, numbers & _ only';
      if (!u.password) e[`user_${i}_password`] = 'Password required';
      else if (u.password.length < 8) e[`user_${i}_password`] = 'Min 8 characters';
      else if (!/[a-zA-Z]/.test(u.password) || !/[0-9]/.test(u.password))
        e[`user_${i}_password`] = 'Must include letters and numbers';
    });
    return e;
  }

  // ── Save ───────────────────────────────────────────────────────
  const save = async () => {
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setLoading(true); setErrors({});

    // Build users — skip completely empty rows
    const validUsers = users.filter(u => u.username?.trim() && u.password);

    // Build custom roles with permissions
    const rolesPayload = customRoles.map(r => ({
      role_name:   r.role_name,
      description: r.description || null,
      permissions: Array.from(rolePerms[r.role_name] || []),
    }));

    const payload = {
      operation_mode: opMode,
      payment_modes:  payModes,
      omc_name:       omcName    || undefined,
      dealer_code:    dealerCode || undefined,
      shifts:         opMode === 'shift_based' ? shifts : [],
      custom_roles:   rolesPayload,
      rbac_enabled:   rbac,
      users:          validUsers.map(({ showPw, ...rest }) => rest),
    };

    try {
      await api('/wizard/step5', 'POST', payload);
      toast('Setup complete! 🎉', 'success');
      onNext();
    } catch (err) {
      if (err.data?.errors) setErrors(err.data.errors);
      else toast(err.data?.error || 'Failed to save.', 'error');
    } finally { setLoading(false); }
  };

  if (fetching) return <div className="sw-loading"><Spinner size={36} /></div>;

  const allRoleOptions = [...ALL_ROLES, ...customRoles.map(r => r.role_name.toLowerCase())];

  return (
    <div className="sw-step">
      <div className="sw-step-intro">
        <h2>Operational Settings</h2>
        <p>Final step — configure how your station operates, manage staff, and set up access control.</p>
      </div>

      {/* ── 1. OPERATION MODE ── */}
      <Card icon="schedule" title="Operation Mode">
        <div className="sw-grid-2">
          {[
            { val: '24hours',    label: '24 Hours',    desc: 'Pump operates continuously',    icon: 'schedule' },
            { val: 'shift_based',label: 'Shift-Based', desc: 'Operations divided into shifts', icon: 'history_toggle_off' },
          ].map(opt => (
            <label key={opt.val} className={`sw-op-card${opMode === opt.val ? ' sw-op-active' : ''}`}>
              <input type="radio" name="op_mode" value={opt.val}
                checked={opMode === opt.val} onChange={() => setOpMode(opt.val)} style={{ display: 'none' }} />
              <div className="sw-op-body">
                <div>
                  <p className="sw-op-label">{opt.label}</p>
                  <p className="sw-op-desc">{opt.desc}</p>
                </div>
                <span className="material-symbols-outlined sw-op-icon">{opt.icon}</span>
              </div>
            </label>
          ))}
        </div>
      </Card>

      {/* ── 2. SHIFT CONFIGURATION ── */}
      {opMode === 'shift_based' && (
        <Card icon="timelapse" title="Shift Configuration"
          action={<button className="sw-btn-text" onClick={addShift}>+ Add Shift</button>}>
          {shifts.length === 0 && (
            <p style={{ fontSize: 13, color: 'var(--text2)', textAlign: 'center', padding: '12px 0' }}>
              No shifts added. Click "+ Add Shift" to begin.
            </p>
          )}
          <div className="sw-shift-list">
            {shifts.map((sh, i) => (
              <div className="sw-shift-row" key={i}>
                <select className="sw-shift-icon-sel" value={sh.icon} onChange={setShiftF(i, 'icon')}>
                  {SHIFT_ICONS.map(ic => <option key={ic} value={ic}>{ic}</option>)}
                </select>
                <div className="sw-shift-fields">
                  <input
                    className={`sw-shift-name${errors[`shift_${i}_name`] ? ' sw-inp-err' : ''}`}
                    value={sh.shift_name} onChange={setShiftF(i, 'shift_name')}
                    placeholder="Shift name (e.g. Morning Shift)" />
                  {errors[`shift_${i}_name`] && <Err msg={errors[`shift_${i}_name`]} />}
                  <div className="sw-shift-times">
                    <div className="sw-field">
                      <label>Start</label>
                      <input type="time" value={sh.start_time} onChange={setShiftF(i, 'start_time')}
                        className={errors[`shift_${i}_start`] ? 'sw-inp-err' : ''} />
                      {errors[`shift_${i}_start`] && <Err msg={errors[`shift_${i}_start`]} />}
                    </div>
                    <span className="sw-arrow">→</span>
                    <div className="sw-field">
                      <label>End</label>
                      <input type="time" value={sh.end_time} onChange={setShiftF(i, 'end_time')}
                        className={errors[`shift_${i}_end`] ? 'sw-inp-err' : ''} />
                      {errors[`shift_${i}_end`] && <Err msg={errors[`shift_${i}_end`]} />}
                    </div>
                  </div>
                </div>
                {shifts.length > 1 && (
                  <button className="sw-btn-del" onClick={() => removeShift(i)}>
                    <span className="material-symbols-outlined">delete</span>
                  </button>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* ── 3. PAYMENT MODES ── */}
      <Card icon="payments" title="Payment Modes">
        {errors.pay && <Err msg={errors.pay} />}
        <div className="sw-pay-grid">
          {PAY_MODES.map(({ id, label, icon }) => (
            <label key={id} className={`sw-pay-card${payModes.includes(id) ? ' sw-pay-active' : ''}`}>
              <input type="checkbox" checked={payModes.includes(id)}
                onChange={() => togglePay(id)} style={{ display: 'none' }} />
              <span className="material-symbols-outlined sw-pay-icon">{icon}</span>
              <span className="sw-pay-label">{label}</span>
              {payModes.includes(id) && <span className="sw-pay-check material-symbols-outlined">check_circle</span>}
            </label>
          ))}
        </div>
      </Card>

      {/* ── 4. ROLES & RBAC ── */}
      <Card icon="manage_accounts" title="Roles & Access Control">

        {/* RBAC Toggle */}
        <div className="sw5-rbac-toggle-wrap">
          <div className="sw5-rbac-info">
            <span className="material-symbols-outlined" style={{ color: 'var(--primary)', fontSize: 20 }}>
              {rbac ? 'lock' : 'lock_open'}
            </span>
            <div>
              <p className="sw5-rbac-title">Role-Based Access Control (RBAC)</p>
              <p className="sw5-rbac-sub">
                {rbac ? 'Enabled — staff access is restricted by role' : 'Disabled — all staff share full access'}
              </p>
            </div>
          </div>
          <label className="sw5-toggle">
            <input type="checkbox" checked={rbac} onChange={e => setRbac(e.target.checked)} />
            <span className="sw5-toggle-track">
              <span className="sw5-toggle-thumb" />
            </span>
          </label>
        </div>

        {/* Default Roles */}
        <div style={{ marginTop: 16 }}>
          <p className="sw5-section-label">Default Roles</p>
          <div className="sw-def-roles">
            {ALL_ROLES.map(r => (
              <span key={r} className="sw-role-def"
                style={{ textTransform: 'capitalize' }}>{r}</span>
            ))}
            <span className="sw-roles-note">Built-in roles. Add custom roles below.</span>
          </div>
        </div>

        {/* Custom Role Add */}
        <div style={{ marginTop: 16 }}>
          <p className="sw5-section-label">Custom Roles</p>
          <div className="sw-role-add">
            <input value={newRoleName} onChange={e => setNewRoleName(e.target.value)}
              placeholder="e.g. Supervisor, Security Guard"
              className="sw-role-input"
              onKeyDown={e => e.key === 'Enter' && addRole()} />
            <button className="sw-btn-role-add" onClick={addRole} disabled={!newRoleName.trim()}>
              <span className="material-symbols-outlined">add</span> Add
            </button>
          </div>
        </div>

        {/* Custom Roles List + Permissions */}
        {customRoles.length > 0 && (
          <div className="sw5-role-list">
            {customRoles.map((r, i) => (
              <div key={i} className="sw5-role-card">
                <div className="sw5-role-head">
                  <span className="material-symbols-outlined" style={{ color: 'var(--primary)', fontSize: 18 }}>badge</span>
                  <span className="sw5-role-name">{r.role_name}</span>
                  <button onClick={() => removeRole(i)} className="sw-role-rm" title="Remove role">
                    <span className="material-symbols-outlined">close</span>
                  </button>
                </div>
                {/* Permissions — only show when RBAC is enabled */}
                {rbac && (
                  <div className="sw5-perms">
                    <p className="sw5-perms-label">Permissions</p>
                    <div className="sw5-perms-grid">
                      {PERMISSIONS_LIST.map(p => {
                        const checked = (rolePerms[r.role_name] || new Set()).has(p.key);
                        return (
                          <label key={p.key}
                            className={`sw5-perm-item${checked ? ' sw5-perm-on' : ''}`}>
                            <input type="checkbox" checked={checked}
                              onChange={() => togglePerm(r.role_name, p.key)}
                              style={{ display: 'none' }} />
                            <span className="material-symbols-outlined"
                              style={{ fontSize: 16 }}>{p.icon}</span>
                            <span>{p.label}</span>
                            {checked && <span className="material-symbols-outlined sw5-perm-check">check</span>}
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* ── 5. STAFF ACCOUNTS ── */}
      <Card icon="group_add" title="Staff Accounts"
        action={
          <button className="sw-btn-text" onClick={addUser}>
            <span className="material-symbols-outlined" style={{ fontSize: 16, verticalAlign: 'middle' }}>add</span>
            {' '}Add Staff
          </button>
        }>
        <p style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 16 }}>
          Create login credentials for your staff. Passwords are securely hashed.
          Leave a row blank to skip it.
        </p>

        {users.map((u, i) => (
          <div key={i} className="sw5-user-card">
            <div className="sw5-user-head">
              <div className="sw5-user-avatar">
                {u.full_name ? u.full_name[0].toUpperCase() : (i + 1)}
              </div>
              <p className="sw5-user-num">Staff {i + 1}</p>
              {users.length > 1 && (
                <button className="sw-btn-del" onClick={() => removeUser(i)}
                  title="Remove staff">
                  <span className="material-symbols-outlined">delete</span>
                </button>
              )}
            </div>

            <div className="sw-grid-2" style={{ marginBottom: 10 }}>
              <div className="sw-field">
                <label>Full Name</label>
                <input
                  value={u.full_name}
                  onChange={e => setUserF(i, 'full_name', e.target.value)}
                  placeholder="e.g. Ramesh Kumar"
                  className={errors[`user_${i}_full_name`] ? 'sw-inp-err' : ''} />
                <Err msg={errors[`user_${i}_full_name`]} />
              </div>
              <div className="sw-field">
                <label>Username</label>
                <input
                  value={u.username}
                  onChange={e => setUserF(i, 'username', e.target.value.toLowerCase())}
                  placeholder="e.g. ramesh1"
                  className={errors[`user_${i}_username`] ? 'sw-inp-err' : ''} />
                <Err msg={errors[`user_${i}_username`]} />
                {!errors[`user_${i}_username`] && <p className="sw-hint">Min 3 chars, letters/numbers/_</p>}
              </div>
            </div>

            <div className="sw-grid-2">
              <div className="sw-field">
                <label>Password</label>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <input
                    type={u.showPw ? 'text' : 'password'}
                    value={u.password}
                    onChange={e => setUserF(i, 'password', e.target.value)}
                    placeholder="Min 8 chars, letters + numbers"
                    className={errors[`user_${i}_password`] ? 'sw-inp-err' : ''}
                    style={{ paddingRight: 36 }} />
                  <span
                    className="material-symbols-outlined"
                    onClick={() => setUserF(i, 'showPw', !u.showPw)}
                    style={{
                      position: 'absolute', right: 10,
                      cursor: 'pointer', fontSize: 18, color: 'var(--text3)',
                    }}>
                    {u.showPw ? 'visibility_off' : 'visibility'}
                  </span>
                </div>
                <Err msg={errors[`user_${i}_password`]} />
                {!errors[`user_${i}_password`] && <p className="sw-hint">Min 8 chars, must include numbers</p>}
              </div>
              <div className="sw-field">
                <label>Role</label>
                <select
                  value={u.role}
                  onChange={e => setUserF(i, 'role', e.target.value)}>
                  {allRoleOptions.map(r => (
                    <option key={r} value={r}
                      style={{ textTransform: 'capitalize' }}>
                      {r.charAt(0).toUpperCase() + r.slice(1)}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        ))}

        <button className="sw5-add-staff-btn" onClick={addUser}>
          <span className="material-symbols-outlined">person_add</span>
          Add Another Staff Member
        </button>
      </Card>

      {/* ── 6. OMC SETTINGS ── */}
      <Card icon="local_gas_station" title="OMC Settings">
        <div className="sw-grid-2">
          <div className="sw-field">
            <label>Oil Marketing Company</label>
            <select value={omcName} onChange={e => setOmcName(e.target.value)}>
              <option value="">-- Select OMC --</option>
              {VALID_OMC.map(o => <option key={o}>{o}</option>)}
            </select>
          </div>
          <div className="sw-field">
            <label>Dealer Code / RO ID <span className="sw-hint">(Optional)</span></label>
            <input value={dealerCode} onChange={e => setDealerCode(e.target.value)}
              placeholder="e.g. 12345678" />
          </div>
        </div>
      </Card>

      <NavBar step={5} loading={loading} onBack={onBack} onSave={save} />
    </div>
  );
}
// ══════════════════════════════════════════════════════════════════
// SUCCESS
// ══════════════════════════════════════════════════════════════════
function SuccessScreen() {
  const navigate = useNavigate();
  return (
    <div className="sw-success">
      <div className="sw-success-icon">
        <span className="material-symbols-outlined">check_circle</span>
      </div>
      <h1>Setup Complete!</h1>
      <p>Your petrol station is fully configured and ready to go.</p>
      <button className="sw-btn-save" onClick={() => navigate('/dashboard')}>
        <span className="material-symbols-outlined">dashboard</span>
        Go to Dashboard
      </button>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// ROOT
// ══════════════════════════════════════════════════════════════════
export default function SetupWizard() {
  const navigate   = useNavigate();
  const topRef     = useRef(null);
  const [step,     setStep]     = useState(1);
  const [progress, setProgress] = useState(null);
  const [toast,    setToast]    = useState({ msg:'', type:'' });
  const [done,     setDone]     = useState(false);

  const showToast = (msg, type='success') => setToast({ msg, type });

  const loadProgress = useCallback(() => {
    api('/wizard/progress').then(setProgress).catch(() => {});
  }, []);

  useEffect(() => { loadProgress(); }, []);

  useEffect(() => {
    if (progress?.current_step && progress.current_step !== step) {
      setStep(progress.current_step);
    }
  }, [progress]);

  const goNext = () => {
    loadProgress();
    if (step >= 5) { setDone(true); return; }
    setStep(s => s + 1);
    topRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const goBack = () => {
    if (step === 1) { navigate('/'); return; }
    setStep(s => s - 1);
    topRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const props = { onNext: goNext, onBack: goBack, toast: showToast };

  return (
    <div className="sw-root">
      <header className="sw-header" ref={topRef}>
        <div className="sw-brand">
          <span className="material-symbols-outlined sw-brand-icon">local_gas_station</span>
          <span className="sw-brand-name">PetroSmart</span>
        </div>
        <span className="sw-header-badge">Setup Wizard</span>
      </header>

      <main className="sw-main">
        {!done && <Stepper current={step} progress={progress} />}
        {done
          ? <SuccessScreen />
          : <>
              {step === 1 && <Step1 {...props} />}
              {step === 2 && <Step2 {...props} />}
              {step === 3 && <Step3 {...props} />}
              {step === 4 && <Step4 {...props} />}
              {step === 5 && <Step5 {...props} />}
            </>
        }
      </main>

      <footer className="sw-footer">© 2025 PetroSmart Systems. All rights reserved.</footer>
      <Toast msg={toast.msg} type={toast.type} onClose={() => setToast({ msg:'', type:'' })} />
    </div>
  );
}
// ── Named exports so the Settings page can reuse each step ────────
export { Step1, Step2, Step3, Step4, Step5 };