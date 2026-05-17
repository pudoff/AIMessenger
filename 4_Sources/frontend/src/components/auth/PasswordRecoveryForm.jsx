import { useState } from 'react';
import { MOCK_USERS } from '../../data/users'; // Для демо-проверки

function PasswordRecoveryForm({ onSubmit, onCancel, onBack }) {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [isSent, setIsSent] = useState(false);

  const handleSubmit = (event) => {
    event.preventDefault();
    const cleanEmail = email.trim().toLowerCase();
    
    if (!cleanEmail) {
      return setError('Введите email');
    }

    // Демо-логика: всегда показываем успех (безопасность)
    const userExists = MOCK_USERS.some((u) => u.email?.toLowerCase() === cleanEmail);
    
    // В реальном приложении: вызов пропса onSubmit с email
    if (onSubmit) {
      onSubmit(cleanEmail, userExists);
    }
    
    setIsSent(true);
    setError('');
  };

  // ─────────────────────────────────────────────────────────
  // 📧 Состояние: письмо отправлено
  // ─────────────────────────────────────────────────────────
  if (isSent) {
    return (
      <div className="auth-card__heading">
        <h1>✅ Проверьте почту</h1>
        <p>Если аккаунт с адресом <strong>{email}</strong> существует, мы отправили ссылку для сброса пароля.</p>
        
        <div className="auth-form" style={{ textAlign: 'left', padding: '0 8px', marginTop: '24px' }}>
          <p style={{ color: 'var(--text-soft)', marginBottom: '24px' }}>
            Ссылка действительна 30 минут. Если письмо не пришло, проверьте папку «Спам».
          </p>
          
          <button 
            className="secondary-button" 
            type="button" 
            onClick={onBack}
            style={{ width: '100%' }}
          >
            Вернуться ко входу
          </button>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────
  // 📧 Состояние: форма ввода email
  // ─────────────────────────────────────────────────────────
  return (
    <>
      <div className="auth-card__heading">
        <h1>Восстановление пароля</h1>
        <p>Введите email, указанный при регистрации. Мы отправим ссылку для смены пароля.</p>
      </div>

      <form className="auth-form" onSubmit={handleSubmit}>
        <label>
          <span>Почта *</span>
          <input
            type="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setError('');
            }}
            placeholder="example@mail.ru"
            required
            autoFocus
          />
        </label>

        {error && <div className="form-error">{error}</div>}

        <button className="primary-button auth-form__submit" type="submit">
          Отправить ссылку
        </button>

        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
          {onCancel && (
            <button 
              type="button" 
              className="secondary-button" 
              onClick={onCancel}
              style={{ flex: 1 }}
            >
              Отмена
            </button>
          )}
          <button 
            type="button" 
            className="auth-form__footer-link" 
            onClick={onBack}
            style={{ 
              background: 'none', 
              border: 'none', 
              color: 'var(--text-soft)', 
              cursor: 'pointer', 
              font: 'inherit',
              flex: 1
            }}
          >
            ← Назад ко входу
          </button>
        </div>
      </form>
    </>
  );
}

export default PasswordRecoveryForm;