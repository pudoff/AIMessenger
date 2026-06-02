import { useEffect } from 'react';
import { createPortal } from 'react-dom';

function LegalModal({ isOpen, onClose, title, sections }) {
  useEffect(() => {
    if (!isOpen) return;
    const handleEsc = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', handleEsc);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleEsc);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) onClose();
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="legal-modal" onClick={handleOverlayClick} role="dialog" aria-modal="true">
      <div className="legal-modal__content">
        <div className="legal-modal__header">
          <h2 id="legal-modal-title">{title}</h2>
          <button className="legal-modal__close" type="button" onClick={onClose} aria-label="Закрыть">
            ×
          </button>
        </div>
        
        <div className="legal-modal__body">
          {sections?.map((section, index) => (
            <div key={index}>
              {section.heading && <strong>{section.heading}</strong>}
              <p>{section.text}</p>
            </div>
          ))}
        </div>
        
        <div className="legal-modal__footer">
          <button className="primary-button" type="button" onClick={onClose}>
            Понятно
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

export default LegalModal;