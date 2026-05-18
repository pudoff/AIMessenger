import { useState } from 'react';
import SectionHeader from '../../components/SectionHeader';
import { adminAPI } from '../../api/admin';

function AdminBroadcast() {
  const [emailForm, setEmailForm] = useState({ subject: '', message: '', emails: '' });
  const [emailStatus, setEmailStatus] = useState(null);
  const [isSendingEmail, setIsSendingEmail] = useState(false);

  const handleEmailSubmit = async (event) => {
    event.preventDefault();
    setEmailStatus(null);
    setIsSendingEmail(true);

    const emails = emailForm.emails
      .split(/[\n,;]/)
      .map((item) => item.trim())
      .filter(Boolean);

    try {
      const result = await adminAPI.sendBroadcast({
        subject: emailForm.subject.trim(),
        message: emailForm.message.trim(),
        ...(emails.length ? { emails } : {}),
      });
      setEmailStatus({ type: 'success', text: `Письмо отправлено. Получателей: ${result.recipients?.length || 0}` });
      setEmailForm({ subject: '', message: '', emails: '' });
    } catch (error) {
      setEmailStatus({ type: 'error', text: error.message || 'Не удалось отправить письмо' });
    } finally {
      setIsSendingEmail(false);
    }
  };

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
            <label htmlFor="email-recipients">Получатели</label>
            <textarea
              id="email-recipients"
              value={emailForm.emails}
              onChange={(event) => setEmailForm((prev) => ({ ...prev, emails: event.target.value }))}
              placeholder="Оставьте пустым, чтобы отправить всем активным пользователям с e-mail"
              rows={3}
            />
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