function Logo({ compact = false, hideText = false }) {
  return (
    <div className={`brand ${compact ? 'brand--compact' : ''} ${hideText ? 'brand--centered' : ''}`}>
      <div className="brand__image" aria-label="Наш слон" />
      
      {!compact && !hideText && (
        <div>
          <div className="brand__title">Наш слон</div>
          <div className="brand__subtitle">Интеллектуальный чат</div>
        </div>
      )}
    </div>
  );
}

export default Logo;