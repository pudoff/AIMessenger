import { useState, useEffect } from 'react';
import { Link, Navigate, useParams, useNavigate } from 'react-router-dom';
import SectionHeader from '../../components/SectionHeader';
import { contactsAPI } from '../../api/contacts';

// Форматеры (без изменений)
const formatContact = (c) => ({
  id: c.id,
  userId: c.contact,
  fullName: `${c.contact_detail?.first_name || ''} ${c.contact_detail?.last_name || ''}`.trim() || c.contact_detail?.username || 'Без имени',
  initials: ((`${c.contact_detail?.first_name || ''} ${c.contact_detail?.last_name || ''}`.trim() || c.contact_detail?.username).slice(0, 2) || '??').toUpperCase(),
  phone: c.contact_detail?.phone_number || '',
  email: c.contact_detail?.email || '',
  role: c.contact_detail?.role || 'user',
  username: c.contact_detail?.username || '',
  location: 'Не указан',
  department: 'Не указано',
  bio: 'Нет информации',
});

const formatSearchResult = (u) => ({
  userId: u.id,
  fullName: `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.username || 'Без имени',
  initials: ((`${u.first_name || ''} ${u.last_name || ''}`.trim() || u.username).slice(0, 2) || '??').toUpperCase(),
  username: u.username,
  email: u.email,
});

function ContactsPage() {
  const { contactId } = useParams();
  const navigate = useNavigate();

  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [addingUserId, setAddingUserId] = useState(null);

  // 1. Загрузка контактов
  useEffect(() => {
    const fetchContacts = async () => {
      try {
        const data = await contactsAPI.getList();
        const list = Array.isArray(data) ? data : data.results || [];
        setContacts(list.map(formatContact));
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchContacts();
  }, []);

  // 2. Поиск
  useEffect(() => {
    if (!searchQuery.trim()) { setSearchResults([]); return; }
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const data = await contactsAPI.search(searchQuery);
        const list = Array.isArray(data) ? data : data.results || [];
        const filtered = list.filter(u => u.role !== 'admin');
        setSearchResults(filtered.map(formatSearchResult));
      } catch (err) { console.error(err); }
      finally { setSearching(false); }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // 3. Добавление контакта
  const handleAddContact = async (userId) => {
    setAddingUserId(userId);
    try {
      await contactsAPI.add({ contact: userId });
      const data = await contactsAPI.getList();
      const list = Array.isArray(data) ? data : data.results || [];
      setContacts(list.map(formatContact));
      setSearchQuery('');
      setSearchResults([]);
    } catch (err) { alert(err.message); }
    finally { setAddingUserId(null); }
  };

  // 4. Удаление контакта
  const handleDeleteContact = async () => {
    if (!selectedContact || !window.confirm('Удалить контакт?')) return;
    setDeleting(true);
    try {
      await contactsAPI.remove(selectedContact.id);
      setContacts((prev) => prev.filter((c) => c.id !== selectedContact.id));
      navigate('/app/contacts', { replace: true });
    } catch (err) {
      alert(err.message);
    } finally {
      setDeleting(false);
    }
  };

  const handleStartChat = async () => {
    if (!selectedContact) return;

    try {
      const result = await contactsAPI.openDirect(selectedContact.id);
      const finalChatId = result?.chat;
      if (!finalChatId) {
        throw new Error('Бэкенд не вернул идентификатор чата');
      }

      navigate(`/app/direct/${finalChatId}`, {
        replace: true,
        state: { contactName: selectedContact.fullName, contactInitials: selectedContact.initials }
      });
    } catch (err) {
      alert(err.message || 'Не удалось открыть чат');
    }
  };

  const selectedContact = contacts.find((c) => String(c.id) === contactId) || contacts[0] || null;

  if (contactId && !contacts.find((c) => String(c.id) === contactId)) {
    return <Navigate to="/app/contacts" replace />;
  }

  const isSearchMode = searchQuery.trim().length > 0;
  const currentList = isSearchMode ? searchResults : contacts;
  const currentLoading = isSearchMode ? searching : loading;

  return (
    <div className="workspace workspace--contacts">
      {/* ЛЕВАЯ ПАНЕЛЬ */}
      <section className="panel panel--list">
        <SectionHeader title="Контакты" subtitle="Список сотрудников и участников" />
        <div className="contacts-search-box">
          <input type="search" className="contacts-search-input" placeholder="Поиск контактов..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
        </div>
        {error && <div className="contacts-error">{error}</div>}
        <div className="list-stack">
          {currentLoading && <div className="contacts-empty">Загрузка...</div>}
          {!currentLoading && currentList.length === 0 && (
            <div className="contacts-empty">{isSearchMode ? 'Ничего не найдено' : 'Список пуст'}</div>
          )}
          {!currentLoading && currentList.map((item) => {
            const alreadyAdded = !isSearchMode || contacts.some(c => c.userId === item.userId);
            const isAdding = addingUserId === item.userId;
            const active = String(item.id) === contactId;
            return (
              <div key={item.userId} className={`contact-row ${active ? 'contact-row--active' : ''}`}>
                <Link className="contact-row__link" to={isSearchMode ? '' : `/app/contacts/${item.id}`} onClick={(e) => isSearchMode && e.preventDefault()}>
                  <div className="contact-row__left">
                    <div className="avatar avatar--circle">{item.initials}</div>
                    <div className="contact-row__text">
                      <strong>{item.fullName}</strong>
                      <span>{item.username}</span>
                    </div>
                  </div>
                </Link>
                {isSearchMode && (
                  <button className={`contact-row__action ${alreadyAdded ? 'contact-row__action--added' : ''}`} type="button" onClick={() => handleAddContact(item.userId)} disabled={alreadyAdded || isAdding}>
                    {isAdding ? '...' : alreadyAdded ? '✓' : '+'}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* ПРАВАЯ ПАНЕЛЬ */}
      <section className="panel panel--contact-card">
        <div className="contacts-header">
          <div>
            <h2 className="contacts-header__title">Карточка контакта</h2>
            <p className="contacts-header__subtitle">Полная информация по выбранному пользователю</p>
          </div>
          {selectedContact && (
            <div className="contacts-header__actions">
              <button className="btn-write-contact" type="button" onClick={handleStartChat} title="Написать сообщение">✉️ Написать</button>
              <button className="btn-delete-contact" type="button" onClick={handleDeleteContact} disabled={deleting} title="Удалить из контактов">{deleting ? '...' : 'Удалить'}</button>
            </div>
          )}
        </div>
        {loading && <div className="contacts-empty">Загрузка...</div>}
        {!loading && selectedContact ? (
          <div className="contact-profile">
            <div className="contact-profile__hero">
              <div className="avatar avatar--primary avatar--xl avatar--circle">{selectedContact.initials}</div>
              <div className="contact-profile__head">
                <h2>{selectedContact.fullName}</h2>
                <p>{selectedContact.role === 'admin' ? 'Администратор' : 'Сотрудник'}</p>
                <span>{selectedContact.username}</span>
              </div>
            </div>
            <div className="contact-info-grid">
              <article className="info-card"><strong>Телефон</strong><span>{selectedContact.phone || '—'}</span></article>
              <article className="info-card"><strong>Электронная почта</strong><span>{selectedContact.email || '—'}</span></article>
            </div>
          </div>
        ) : (
          <div className="contacts-empty">{contacts.length === 0 ? 'Добавьте контакты через поиск' : 'Выберите контакт из списка'}</div>
        )}
      </section>
    </div>
  );
}

export default ContactsPage;