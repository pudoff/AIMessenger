import { Link, Navigate, useParams } from 'react-router-dom';
import SectionHeader from '../../components/SectionHeader';
import { contacts } from '../../data/contacts';

function ContactsPage() {
  const { contactId } = useParams();
  const matchedContact = contacts.find((contact) => contact.id === contactId);
  const selectedContact = matchedContact || contacts[0];

  if (contactId && !matchedContact) {
    return <Navigate to="/app/contacts" replace />;
  }

  return (
    <div className="workspace workspace--contacts">
      <section className="panel panel--list">
        <SectionHeader title="Контакты" subtitle="Список сотрудников и участников мессенджера" />

        <div className="list-stack">
          {contacts.map((contact) => {
            const active = contact.id === selectedContact.id;

            return (
              <Link
                key={contact.id}
                className={`contact-row ${active ? 'contact-row--active' : ''}`}
                to={`/app/contacts/${contact.id}`}
              >
                <div className="contact-row__left">
                  <div className="avatar avatar--circle">{contact.initials}</div>
                  <div className="contact-row__text">
                    <strong>{contact.fullName}</strong>
                    <span>{contact.phone}</span>
                  </div>
                </div>
                <small>{contact.messengerId}</small>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="panel panel--contact-card">
        <SectionHeader title="Карточка контакта" subtitle="Полная информация по выбранному пользователю" />

        <div className="contact-profile">
          <div className="contact-profile__hero">
            <div className="avatar avatar--primary avatar--xl avatar--circle">
              {selectedContact.initials}
            </div>
            <div className="contact-profile__head">
              <h2>{selectedContact.fullName}</h2>
              <p>{selectedContact.role}</p>
              <span>{selectedContact.messengerId}</span>
            </div>
          </div>

          <div className="contact-info-grid">
            <article className="info-card">
              <strong>Телефон</strong>
              <span>{selectedContact.phone}</span>
            </article>
            <article className="info-card">
              <strong>Электронная почта</strong>
              <span>{selectedContact.email}</span>
            </article>
            <article className="info-card">
              <strong>Город</strong>
              <span>{selectedContact.location}</span>
            </article>
            <article className="info-card">
              <strong>Подразделение</strong>
              <span>{selectedContact.department}</span>
            </article>
          </div>

          <article className="contact-about">
            <strong>Дополнительная информация</strong>
            <p>{selectedContact.bio}</p>
          </article>
        </div>
      </section>
    </div>
  );
}

export default ContactsPage;
