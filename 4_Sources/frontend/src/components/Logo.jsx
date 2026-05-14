import defaultLogo from '../assets/logo_new.png';

function Logo({ compact = false, src = defaultLogo, hideText = false }) {
  return (
    <div className={`brand ${compact ? 'brand--compact' : ''} ${hideText ? 'brand--centered' : ''}`}>
      <img className="brand__image" src={src} alt="Наш слон" />
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
