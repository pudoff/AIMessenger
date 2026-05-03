import { useState } from 'react';
import ChatComposer from '../../components/ChatComposer';
import MessageBubble from '../../components/MessageBubble';
import SectionHeader from '../../components/SectionHeader';
import { groupChats } from '../../data/groupChats';

function GroupChatsPage() {
  const [groups, setGroups] = useState(groupChats);
  const [selectedGroupId, setSelectedGroupId] = useState(null);
  const [lastSelectedGroupId, setLastSelectedGroupId] = useState(groupChats[0]?.id ?? null);
  const selectedGroup = groups.find((group) => group.id === selectedGroupId) || groups[0];

  const handleSend = (text) => {
    setGroups((prev) =>
      prev.map((group) =>
        group.id === selectedGroupId
          ? {
              ...group,
              messages: [
                ...group.messages,
                {
                  id: Date.now(),
                  author: 'Вы',
                  time: new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
                  text,
                  tag: 'Обычное'
                }
              ]
            }
          : group
      )
    );
  };

  return (
    <div className="workspace workspace--split">
      {!selectedGroupId ? (
        <section className="panel panel--list panel--list-only">
          <SectionHeader title="Корпоративные чаты" subtitle="Рабочие группы и проектные обсуждения" />
          <div className="list-stack">
            {groups.map((group) => (
              <button
                className={`chat-card chat-card--button ${group.id === lastSelectedGroupId ? 'chat-card--active' : ''}`}
                key={group.id}
                type="button"
                onClick={() => {
                  setSelectedGroupId(group.id);
                  setLastSelectedGroupId(group.id);
                }}
              >
                <div className="chat-card__top">
                  <h3>{group.name}</h3>
                  <span className="badge badge--soft">{group.members}</span>
                </div>
                <p>{group.description}</p>
                <small>{group.members} участников</small>
              </button>
            ))}
          </div>
        </section>
      ) : (
        <section className="panel panel--chat panel--chat-only">
          <div className="chat-toolbar chat-toolbar--stack">
            <div className="chat-toolbar__head">
              <button className="secondary-button secondary-button--back" type="button" onClick={() => setSelectedGroupId(null)}>
                Назад к чатам
              </button>
              <div>
                <strong>{selectedGroup.name}</strong>
                <p>{selectedGroup.description}. {selectedGroup.members} участников</p>
              </div>
            </div>
          </div>
          <div className="messages-feed">
            {selectedGroup.messages.map((message) => (
              <MessageBubble key={message.id} message={message} />
            ))}
          </div>
          <ChatComposer placeholder={`Сообщение в чат «${selectedGroup.name}»`} onSend={handleSend} />
        </section>
      )}
    </div>
  );
}

export default GroupChatsPage;
