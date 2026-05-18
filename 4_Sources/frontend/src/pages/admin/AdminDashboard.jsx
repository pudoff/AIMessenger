import { useState, useEffect } from 'react';
import SectionHeader from '../../components/SectionHeader';
import { adminAPI } from '../../api/admin';

function AdminBroadcast() {
  const [emailForm, setEmailForm] = useState({ subject: '', message: '', userIds: [] });
  const [emailStatus, setEmailStatus] = useState(null);
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [users, setUsers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [dropdownOpen, setDropdownOpen] = useState(false);

  // Загрузка списка пользователей при монтировании
  useEffect(() => {
    const loadUsers = async () => {
      try {
        const data = await adminAPI.getUsers({ limit: 1000, offset: 0 });
        console.log('Полный ответ от API getUsers:', data);

        // Обрабатываем разные форматы ответа
        let usersList = [];
        if (Array.isArray(data)) {
          usersList = data;
        } else if (data && data.results && Array.isArray(data.results)) {
          usersList = data.results;
        } else if (data && data.users && Array.isArray(data.users)) {
          usersList = data.users;
        }

        console.log('Обработанный список пользователей:', usersList);
        setUsers(usersList);
      } catch (error) {
        console.error('Не удалось загрузить пользователей:', error);
      }
    };
    loadUsers();
  }, []);

  const filteredUsers = users.filter(user => {
    const query = searchTerm.toLowerCase();
    const username = (user.username || '').toLowerCase();
    const email = (user.email || '').toLowerCase();
    return username.includes(query) || email.includes(query);
  });

  const toggleUser = (userId) => {
    setEmailForm(prev => ({
      ...prev,
      userIds: prev.userIds.includes(userId)
        ? prev.userIds.filter(id => id !== userId)
        : [...prev.userIds, userId]
    }));
  };

  const removeUser = (userId) => {
    setEmailForm(prev => ({
      ...prev,
      userIds: prev.userIds.filter(id => id !== userId)
    }));
  };

  const handleEmailSubmit = async (event) => {
    event.preventDefault();
    setEmailStatus(null);
    setIsSendingEmail(true);

    try {
      const result = await adminAPI.sendBroadcast({
        subject: emailForm.subject.trim(),
        message: emailForm.message.trim(),
        ...(emailForm.userIds.length ? { user_ids: emailForm.userIds } : {}),
      });
      setEmailStatus({ type: 'success', text: `Письмо отправлено. Получателей: ${result.recipients?.length || emailForm.userIds.length}` });
      setEmailForm({ subject: '', message: '', userIds: [] });
      setSearchTerm('');
    } catch (error) {
      setEmailStatus({ type: 'error', text: error.message || 'Не удалось отправить письмо' });
    } finally {
      setIsSendingEmail(false);
    }
  };

  const selectedCount = emailForm.userIds.length;
  const selectedUsers = users.filter(u => emailForm.userIds.includes(u.id));

  return (
    <div className="admin-page">
      <SectionHeader title="E-mail рассылка" subtitle="Отправка уведомлений пользователям" />

      <article className="panel">
        <div className="panel__title">Форма рассылки</div>
        <form className="form-stack" onSubmit={handleEmailSubmit}>
          <div className="form-group">
            <label htmlFor="email-subject">Тема письма</label>
            <input
              id="email-subject"
              value={emailForm.subject}
              onChange={(event) => setEmailForm((prev) => ({ ...prev, subject: event.target.value }))}
              placeholder="Например: Итоги недели"
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="email-message">Текст письма</label>
            <textarea
              id="email-message"
              value={emailForm.message}
              onChange={(event) => setEmailForm((prev) => ({ ...prev, message: event.target.value }))}
              placeholder="Введите сообщение для пользователей"
              rows={5}
              required
            />
          </div>

          <div className="form-group">
            <label>Получатели</label>

            {/* Отображение выбранных пользователей */}
            {selectedCount > 0 && (
              <div className="selected-users-list">
                {selectedUsers.map(user => (
                  <span key={user.id} className="user-tag">
                    {user.username || user.email}
                    <button type="button" onClick={() => removeUser(user.id)} className="remove-tag">&times;</button>
                  </span>
                ))}
              </div>
            )}

            {/* Поле поиска с выпадающим списком */}
            <div className="user-select-wrapper" style={{ position: 'relative' }}>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setDropdownOpen(true);
                }}
                onFocus={() => setDropdownOpen(true)}
                onBlur={() => setTimeout(() => setDropdownOpen(false), 200)}
                placeholder={selectedCount === 0 ? "Начните вводить имя или email..." : "Добавить еще пользователей"}
                className="user-search-input"
              />

              {dropdownOpen && filteredUsers.length > 0 && (
                <div className="user-dropdown">
                  {filteredUsers.map(user => {
                    const isSelected = emailForm.userIds.includes(user.id);
                    return (
                      <div
                        key={user.id}
                        className={`user-option ${isSelected ? 'selected' : ''}`}
                        onClick={() => toggleUser(user.id)}
                      >
                        <div className="user-option-info">
                          <span className="user-option-name">{user.username}</span>
                          <span className="user-option-email">{user.email}</span>
                        </div>
                        {isSelected && <span className="checkmark">✓</span>}
                      </div>
                    );
                  })}
                </div>
              )}

              {dropdownOpen && searchTerm && filteredUsers.length === 0 && (
                <div className="user-dropdown">
                  <div className="user-option disabled">Пользователи не найдены</div>
                </div>
              )}
            </div>

            <small className="form-hint">
              {selectedCount === 0
                ? "Оставьте пустым, чтобы отправить всем активным пользователям"
                : `Выбрано пользователей: ${selectedCount}`}
            </small>
          </div>
          {emailStatus && (
            <div className={emailStatus.type === 'success' ? 'form-success' : 'form-error'}>
              {emailStatus.text}
            </div>
          )}
          <button
            className="primary-button"
            type="submit"
            disabled={isSendingEmail || !emailForm.subject.trim() || !emailForm.message.trim()}
          >
            {isSendingEmail ? 'Отправка...' : 'Отправить рассылку'}
          </button>
        </form>
      </article>
    </div>
  );
}

export default AdminBroadcast;