// frontend/src/pages/Settings.jsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Step1, Step2, Step3, Step4, Step5 } from './setupwizard';
import './Setupwizard.css';

const SECTIONS = [
  { id: 1, label: 'Basic Details',   icon: 'store' },
  { id: 2, label: 'Fuel Types',      icon: 'local_gas_station' },
  { id: 3, label: 'Tanks',           icon: 'storage' },
  { id: 4, label: 'Pumps & Nozzles', icon: 'settings_input_component' },
  { id: 5, label: 'Operations',      icon: 'tune' },
];

function SettingsToast({ msg, type, onClose }) {
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

export default function Settings() {
  const navigate = useNavigate();
  const [active, setActive]  = useState(1);
  const [toast, setToast]    = useState({ msg: '', type: '' });

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast({ msg: '', type: '' }), 4000);
  };

  const stepProps = {
    onNext: () => showToast('Saved successfully! ✓', 'success'),
    onBack: () => navigate('/dashboard'),
    toast:  showToast,
  };

  const StepComponent = { 1: Step1, 2: Step2, 3: Step3, 4: Step4, 5: Step5 }[active];

  return (
    <div className="sw-root">
      <header className="sw-header">
        <div className="sw-brand">
          <span className="material-symbols-outlined sw-brand-icon">local_gas_station</span>
          <span className="sw-brand-name">PetroSmart</span>
        </div>
        <span className="sw-header-badge">Settings</span>
      </header>

      <div style={{ display: 'flex', gap: 24, maxWidth: 1200, margin: '0 auto', padding: '24px 16px', width: '100%' }}>
        <nav style={{ width: 220, flexShrink: 0 }}>
          {SECTIONS.map(s => (
            <button
              key={s.id}
              onClick={() => setActive(s.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                width: '100%', textAlign: 'left', padding: '10px 14px',
                marginBottom: 6, borderRadius: 8, border: 'none',
                cursor: 'pointer', fontSize: 14, fontWeight: 600,
                background: active === s.id ? '#0051d5' : 'transparent',
                color: active === s.id ? '#fff' : '#45464d',
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>{s.icon}</span>
              {s.label}
            </button>
          ))}
          <button
            onClick={() => navigate('/dashboard')}
            style={{
              display: 'flex', alignItems: 'center', gap: 10,
              width: '100%', textAlign: 'left', padding: '10px 14px',
              marginTop: 16, borderRadius: 8, border: '1px solid #c6c6cd',
              cursor: 'pointer', fontSize: 14, fontWeight: 600, background: '#fff',
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>arrow_back</span>
            Back to Dashboard
          </button>
        </nav>

        <div style={{ flex: 1, minWidth: 0 }}>
          <StepComponent key={active} {...stepProps} />
        </div>
      </div>

      <SettingsToast msg={toast.msg} type={toast.type} onClose={() => setToast({ msg: '', type: '' })} />
    </div>
  );
}