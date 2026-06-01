import { useEffect, useState } from 'react';
import SectionHeader from '../components/SectionHeader';
import Avatar from '../components/Avatar';
import { authAPI } from '../api/auth';
import { useAuth } from '../context/AuthContext';

function SettingsPage() {
  const { currentUser, refreshProfile } = useAuth();
  const [form, setForm] = useState({ email: '', phone_number: '', current_password: '', new_password: '' });
  const [avatar, setAvatar] = useState(null);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState('');

  useEffect(() => {
    setForm((prev) => ({
      ...prev,
      email: currentUser?.email || '',
      phone_number: currentUser?.phone_number || '',
    }));
  }, [currentUser]);

  useEffect(() => {
    if (!avatar) {
      setAvatarPreviewUrl('');
      return undefined;
    }

    const objectUrl = URL.createObjectURL(avatar);
    setAvatarPreviewUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [avatar]);

  const updateField = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setStatus('');
    setError('');
    try {
      const payload = { email: form.email, phone_number: form.phone_number };
      if (form.new_password) {
        payload.current_password = form.current_password;
        payload.new_password = form.new_password;
      }
      if (avatar) payload.avatar = avatar;
      await authAPI.updateMe(payload);
      await refreshProfile();
      setForm((prev) => ({ ...prev, current_password: '', new_password: '' }));
      setAvatar(null);
      setStatus('Настройки сохранены');
    } catch (err) {
      setError(err.message || 'Не удалось сохранить настройки');
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveAvatar = async () => {
    setSaving(true);
    setStatus('');
    setError('');
    try {
      await authAPI.updateMe({ avatar: null });
      await refreshProfile();
      setStatus('Аватар удален');
    } catch (err) {
      setError(err.message || 'Не удалось удалить аватар');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="settings-page">
      <SectionHeader title="Настройки" subtitle="Профиль, контакты и безопасность аккаунта" />
      <form className="settings-form" onSubmit={handleSubmit}>
        <section className="settings-form__avatar">
          <Avatar
            src={avatarPreviewUrl || currentUser?.avatar_url}
            initials={currentUser?.username?.slice(0, 2) || '??'}
            title="Фото профиля"
            className="avatar--circle settings-form__avatar-preview"
          />
          <label className="secondary-button">
            Изменить фото
            <input type="file" accept="image/*" onChange={(event) => setAvatar(event.target.files?.[0] || null)} />
          </label>
          <button className="secondary-button" type="button" onClick={handleRemoveAvatar} disabled={saving || !currentUser?.avatar_url}>
            Удалить фото
          </button>
        </section>

        <label>E-mail<input value={form.email} onChange={(event) => updateField('email', event.target.value)} type="email" /></label>
        <label>Телефон<input value={form.phone_number} onChange={(event) => updateField('phone_number', event.target.value)} type="tel" /></label>
        <label>Текущий пароль<input value={form.current_password} onChange={(event) => updateField('current_password', event.target.value)} type="password" /></label>
        <label>Новый пароль<input value={form.new_password} onChange={(event) => updateField('new_password', event.target.value)} type="password" /></label>

        {error && <div className="contacts-error">{error}</div>}
        {status && <div className="contacts-empty">{status}</div>}

        <button className="primary-button" type="submit" disabled={saving}>
          {saving ? 'Сохранение...' : 'Сохранить'}
        </button>
      </form>
    </div>
  );
}

export default SettingsPage;
