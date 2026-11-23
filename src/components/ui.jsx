import { useEffect, useId, useRef } from 'react';
import { AlertCircle, CheckCircle2, ChevronLeft, ChevronRight, Info, X } from 'lucide-react';
import { useApp } from '../state/AppContext.jsx';
import { addMonths, formatMonthLabel } from '../utils/dates.js';

// ---------- Modal ----------
export function Modal({ title, onClose, children, footer, size = 'md' }) {
  const ref = useRef(null);
  const titleId = useId();
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const first = ref.current?.querySelector('input, select, textarea, button.btn-primary');
    first?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal modal-${size}`} role="dialog" aria-modal="true" aria-labelledby={titleId} ref={ref}>
        <header className="modal-header">
          <h2 id={titleId}>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Fechar"><X size={18} /></button>
        </header>
        <div className="modal-body">{children}</div>
        {footer && <footer className="modal-footer">{footer}</footer>}
      </div>
    </div>
  );
}

/** actions: [{ label, onClick, variant: 'danger'|'primary'|'ghost' }] */
export function ConfirmDialog({ title, message, actions, onClose }) {
  return (
    <Modal
      title={title}
      onClose={onClose}
      size="sm"
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          {actions.map((a) => (
            <button key={a.label} className={`btn btn-${a.variant || 'primary'}`} onClick={a.onClick}>{a.label}</button>
          ))}
        </>
      }
    >
      <p className="muted">{message}</p>
    </Modal>
  );
}

// ---------- Formulário ----------
export function Field({ label, error, hint, children, htmlFor }) {
  return (
    <div className={`field ${error ? 'has-error' : ''}`}>
      <label htmlFor={htmlFor}>{label}</label>
      {children}
      {error ? <span className="field-error" role="alert">{error}</span> : hint ? <span className="field-hint">{hint}</span> : null}
    </div>
  );
}

// ---------- Cartões ----------
export function Card({ title, action, children, className = '' }) {
  return (
    <section className={`card ${className}`}>
      {(title || action) && (
        <header className="card-header">
          {title && <h3>{title}</h3>}
          {action}
        </header>
      )}
      {children}
    </section>
  );
}

export function StatCard({ label, value, hint, tone = 'neutral', icon: Icon }) {
  return (
    <div className={`stat tone-${tone}`}>
      <div className="stat-top">
        <span className="stat-label">{label}</span>
        {Icon && <Icon size={16} />}
      </div>
      <strong className="stat-value">{value}</strong>
      {hint && <span className="stat-hint">{hint}</span>}
    </div>
  );
}

export function ProgressBar({ percent, tone = 'blue', label }) {
  const clamped = Math.max(0, Math.min(100, percent || 0));
  return (
    <div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(clamped)} aria-label={label}>
      <div className={`progress-fill fill-${tone}`} style={{ width: `${clamped}%` }} />
    </div>
  );
}

export function EmptyState({ icon: Icon, title, text, action }) {
  return (
    <div className="empty">
      {Icon && <Icon size={32} />}
      <strong>{title}</strong>
      {text && <p className="muted">{text}</p>}
      {action}
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }) {
  return (
    <div className="page-header">
      <div>
        <h1>{title}</h1>
        {subtitle && <p className="muted">{subtitle}</p>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </div>
  );
}

// ---------- Navegação de mês ----------
export function MonthNav({ month, onChange }) {
  const { currentMonth } = useApp();
  return (
    <div className="month-nav">
      <button className="icon-btn" aria-label="Mês anterior" onClick={() => onChange(addMonths(month, -1))}><ChevronLeft size={18} /></button>
      <span className="month-label">{formatMonthLabel(month)}</span>
      <button className="icon-btn" aria-label="Próximo mês" onClick={() => onChange(addMonths(month, 1))}><ChevronRight size={18} /></button>
      {month !== currentMonth && (
        <button className="btn btn-ghost btn-sm" onClick={() => onChange(currentMonth)}>Mês atual</button>
      )}
    </div>
  );
}

// ---------- Notificações ----------
export function Toasts() {
  const { toasts, dismissToast } = useApp();
  const icons = { success: CheckCircle2, error: AlertCircle, info: Info };
  return (
    <div className="toasts" aria-live="polite">
      {toasts.map((t) => {
        const Icon = icons[t.type] || Info;
        return (
          <div key={t.id} className={`toast toast-${t.type}`} role={t.type === 'error' ? 'alert' : 'status'}>
            <Icon size={18} />
            <span>{t.message}</span>
            <button className="icon-btn" aria-label="Dispensar" onClick={() => dismissToast(t.id)}><X size={14} /></button>
          </div>
        );
      })}
    </div>
  );
}
