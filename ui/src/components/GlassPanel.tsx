import React from 'react';

interface GlassPanelProps {
  title: string;
  badge?: string;
  children: React.ReactNode;
  style?: React.CSSProperties;
  className?: string;
}

export const GlassPanel: React.FC<GlassPanelProps> = ({
  title,
  badge,
  children,
  style,
  className = '',
}) => {
  return (
    <div
      className={`hud-panel ${className}`}
      style={{
        padding: '16px 20px',
        display: 'flex',
        flexDirection: 'column',
        ...style,
      }}
    >
      <div className="corner-bracket-tl" />
      <div className="corner-bracket-tr" />
      <div className="corner-bracket-bl" />
      <div className="corner-bracket-br" />

      {/* Panel Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottom: '1px solid rgba(0, 240, 255, 0.2)',
          paddingBottom: '8px',
          marginBottom: '12px',
        }}
      >
        <span
          className="font-tech glow-cyan"
          style={{
            fontSize: '13px',
            color: '#00f0ff',
            letterSpacing: '2px',
            textTransform: 'uppercase',
            fontWeight: 700,
          }}
        >
          {title}
        </span>
        {badge && (
          <span
            className="font-mono"
            style={{
              fontSize: '10px',
              padding: '2px 6px',
              borderRadius: '3px',
              background: 'rgba(0, 240, 255, 0.15)',
              color: '#00f0ff',
              border: '1px solid rgba(0, 240, 255, 0.35)',
            }}
          >
            {badge}
          </span>
        )}
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>{children}</div>
    </div>
  );
};
