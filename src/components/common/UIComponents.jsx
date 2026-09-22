import React from 'react';
import { Sparkles, AlertCircle, CheckCircle2, Info, Loader2 } from 'lucide-react';

/**
 * GlassCard Primitive
 * Variants: default | interactive | highlight | elevated
 */
export function GlassCard({ children, className = '', variant = 'default', style = {}, ...props }) {
  const variantClass = {
    default: 'glass-card',
    interactive: 'glass-card-interactive',
    highlight: 'glass-card-highlight',
    solid: 'glass-card-solid',
  }[variant] || 'glass-card';

  return (
    <div className={`${variantClass} ${className}`} style={{ padding: '24px', ...style }} {...props}>
      {children}
    </div>
  );
}

/**
 * StatCard Primitive
 * Displays key metrics with glowing icon container and dynamic subtitles.
 */
export function StatCard({ label, value, subtext, icon: Icon, color = 'purple' }) {
  const colorMap = {
    purple: {
      bg: 'rgba(124, 58, 237, 0.15)',
      border: '#7C3AED',
      color: '#C084FC',
    },
    cyan: {
      bg: 'rgba(56, 189, 248, 0.15)',
      border: '#38BDF8',
      color: '#38BDF8',
    },
    green: {
      bg: 'rgba(16, 185, 129, 0.15)',
      border: '#10B981',
      color: '#34D399',
    },
    amber: {
      bg: 'rgba(245, 158, 11, 0.15)',
      border: '#F59E0B',
      color: '#FBBF24',
    },
  };

  const scheme = colorMap[color] || colorMap.purple;

  return (
    <GlassCard variant="interactive" style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '20px' }}>
      {Icon && (
        <div
          style={{
            width: '48px',
            height: '48px',
            borderRadius: '14px',
            background: scheme.bg,
            border: `1px solid ${scheme.border}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: scheme.color,
            flexShrink: 0,
          }}
        >
          <Icon className="w-6 h-6" />
        </div>
      )}
      <div>
        <span style={{ fontSize: '12px', fontWeight: '700', color: '#94A3B8', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
          {label}
        </span>
        <h3 style={{ fontSize: '24px', fontWeight: '800', color: '#F8FAFC', margin: '2px 0' }}>{value}</h3>
        {subtext && <p style={{ fontSize: '12px', color: '#64748B' }}>{subtext}</p>}
      </div>
    </GlassCard>
  );
}

/**
 * Badge Primitive
 */
export function Badge({ children, variant = 'purple', icon: Icon, style = {} }) {
  const styles = {
    purple: { bg: 'rgba(124, 58, 237, 0.15)', border: 'rgba(168, 85, 247, 0.4)', text: '#C084FC' },
    green: { bg: 'rgba(16, 185, 129, 0.15)', border: 'rgba(16, 185, 129, 0.4)', text: '#34D399' },
    cyan: { bg: 'rgba(56, 189, 248, 0.15)', border: 'rgba(56, 189, 248, 0.4)', text: '#38BDF8' },
    amber: { bg: 'rgba(245, 158, 11, 0.15)', border: 'rgba(245, 158, 11, 0.4)', text: '#FBBF24' },
    red: { bg: 'rgba(239, 68, 68, 0.15)', border: 'rgba(239, 68, 68, 0.4)', text: '#F87171' },
  }[variant] || styles.purple;

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        padding: '4px 10px',
        borderRadius: '9999px',
        fontSize: '12px',
        fontWeight: '700',
        background: styles.bg,
        border: `1px solid ${styles.border}`,
        color: styles.text,
        ...style,
      }}
    >
      {Icon && <Icon className="w-3.5 h-3.5" />}
      {children}
    </span>
  );
}

/**
 * EmptyState Primitive
 */
export function EmptyState({ icon: Icon = Sparkles, title, description, actionText, onAction }) {
  return (
    <div style={{ textAlign: 'center', padding: '48px 24px' }}>
      <div
        style={{
          width: '56px',
          height: '56px',
          borderRadius: '16px',
          background: 'rgba(124, 58, 237, 0.12)',
          border: '1px solid rgba(168, 85, 247, 0.3)',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#C084FC',
          marginBottom: '16px',
        }}
      >
        <Icon className="w-7 h-7" />
      </div>
      <h3 style={{ fontSize: '18px', fontWeight: '800', color: '#F8FAFC', marginBottom: '6px' }}>{title}</h3>
      <p style={{ color: '#94A3B8', fontSize: '14px', maxWidth: '380px', margin: '0 auto 20px auto', lineHeight: 1.5 }}>
        {description}
      </p>
      {actionText && onAction && (
        <button onClick={onAction} className="btn-primary-gradient" style={{ padding: '10px 20px', borderRadius: '12px', fontSize: '13px' }}>
          {actionText}
        </button>
      )}
    </div>
  );
}

/**
 * LoadingSkeleton Primitive
 */
export function LoadingSkeleton({ count = 3, height = '48px', style = {} }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '100%', ...style }}>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          style={{
            height,
            borderRadius: '12px',
            background: 'linear-gradient(90deg, rgba(30,41,59,0.5) 0%, rgba(51,65,85,0.4) 50%, rgba(30,41,59,0.5) 100%)',
            backgroundSize: '200% 100%',
            animation: 'shimmer 1.5s infinite',
          }}
        />
      ))}
    </div>
  );
}

export default {
  GlassCard,
  StatCard,
  Badge,
  EmptyState,
  LoadingSkeleton,
};
