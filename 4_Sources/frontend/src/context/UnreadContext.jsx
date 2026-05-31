import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

const STORAGE_KEY = 'nash_slon_unread_state_v1';

const EMPTY_STATE = {
  direct: {},
  group: {},
  corporate: {},
};

const normalizeScope = (scope) => {
  if (scope === 'direct') return 'direct';
  if (scope === 'corporate') return 'corporate';
  return 'group';
};

const normalizeId = (id) => (id == null ? '' : String(id));

const cloneState = (state) => ({
  direct: { ...(state?.direct || {}) },
  group: { ...(state?.group || {}) },
  corporate: { ...(state?.corporate || {}) },
});

const loadInitialState = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY_STATE;

    return {
      ...EMPTY_STATE,
      ...JSON.parse(raw),
    };
  } catch {
    return EMPTY_STATE;
  }
};

const getLastMessageId = (chat) => (
  chat?.lastMessageId
  || chat?.last_message?.id
  || chat?.lastMessage?.id
  || null
);

const getLastSenderId = (chat) => (
  chat?.last_message?.sender
  || chat?.lastMessage?.sender
  || null
);

const getUnreadFromState = (state, scope, chatId) => {
  const normalizedScope = normalizeScope(scope);
  const id = normalizeId(chatId);
  return Number(state?.[normalizedScope]?.[id]?.unreadCount || 0);
};

const sumScope = (state, scope) => Object.values(state?.[scope] || {}).reduce(
  (sum, item) => sum + Number(item?.unreadCount || 0),
  0,
);

const UnreadContext = createContext(null);

export function UnreadProvider({ children }) {
  const [records, setRecords] = useState(loadInitialState);
  const recordsRef = useRef(records);

  useEffect(() => {
    recordsRef.current = records;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  }, [records]);

  const commitRecords = useCallback((nextRecords) => {
    recordsRef.current = nextRecords;
    setRecords(nextRecords);
  }, []);

  const decorateChatsWithUnread = useCallback((scope, chats, options = {}) => {
    const normalizedScope = normalizeScope(scope);
    const activeChatId = normalizeId(options.activeChatId);
    const currentUserId = normalizeId(options.currentUserId);
    const nextRecords = cloneState(recordsRef.current);
    const scopeRecords = { ...(nextRecords[normalizedScope] || {}) };

    chats.forEach((chat) => {
      const chatId = normalizeId(chat.id);
      if (!chatId) return;

      const lastMessageId = getLastMessageId(chat);
      const lastSenderId = normalizeId(getLastSenderId(chat));
      const serverUnreadCount = chat.unread_count ?? chat.unreadCount;
      const isActive = activeChatId && chatId === activeChatId;
      const isOwnLastMessage = currentUserId && lastSenderId && currentUserId === lastSenderId;
      const previous = scopeRecords[chatId] || {};

      if (serverUnreadCount != null) {
        scopeRecords[chatId] = {
          ...previous,
          lastMessageId: lastMessageId || previous.lastMessageId || null,
          lastReadMessageId: chat.last_read_message || previous.lastReadMessageId || null,
          unreadCount: isActive ? 0 : Number(serverUnreadCount || 0),
        };
        return;
      }

      if (!lastMessageId) {
        scopeRecords[chatId] = {
          ...previous,
          unreadCount: previous.unreadCount || 0,
        };
        return;
      }

      if (!previous.lastMessageId) {
        scopeRecords[chatId] = {
          ...previous,
          lastMessageId,
          lastReadMessageId: isActive ? lastMessageId : previous.lastReadMessageId || null,
          unreadCount: isActive ? 0 : Number(previous.unreadCount || 0),
        };
        return;
      }

      if (isActive || isOwnLastMessage) {
        scopeRecords[chatId] = {
          ...previous,
          lastMessageId,
          lastReadMessageId: lastMessageId,
          unreadCount: 0,
        };
        return;
      }

      if (String(previous.lastMessageId) !== String(lastMessageId)) {
        scopeRecords[chatId] = {
          ...previous,
          lastMessageId,
          unreadCount: Number(previous.unreadCount || 0) + 1,
        };
        return;
      }

      scopeRecords[chatId] = previous;
    });

    nextRecords[normalizedScope] = scopeRecords;
    commitRecords(nextRecords);

    return chats.map((chat) => {
      const unreadCount = getUnreadFromState(nextRecords, normalizedScope, chat.id);
      return {
        ...chat,
        unreadCount,
        hasUnread: Boolean(chat.hasUnread || unreadCount > 0),
      };
    });
  }, [commitRecords]);

  const markChatRead = useCallback((scope, chatId, lastMessageId = null) => {
    const normalizedScope = normalizeScope(scope);
    const id = normalizeId(chatId);
    if (!id) return;

    const nextRecords = cloneState(recordsRef.current);
    const previous = nextRecords[normalizedScope]?.[id] || {};
    const normalizedLastMessageId = lastMessageId || previous.lastMessageId || null;

    nextRecords[normalizedScope] = {
      ...(nextRecords[normalizedScope] || {}),
      [id]: {
        ...previous,
        lastMessageId: normalizedLastMessageId,
        lastReadMessageId: normalizedLastMessageId,
        unreadCount: 0,
      },
    };

    commitRecords(nextRecords);
  }, [commitRecords]);

  const registerOutgoingMessage = useCallback((scope, chatId, messageId = null) => {
    markChatRead(scope, chatId, messageId);
  }, [markChatRead]);

  const getUnreadCount = useCallback((scope, chatId) => (
    getUnreadFromState(records, scope, chatId)
  ), [records]);

  const getSectionUnreadCount = useCallback((section) => {
    if (section === 'direct') return sumScope(records, 'direct');
    if (section === 'groups') return sumScope(records, 'group') + sumScope(records, 'corporate');
    return sumScope(records, 'direct') + sumScope(records, 'group') + sumScope(records, 'corporate');
  }, [records]);

  const value = {
    decorateChatsWithUnread,
    getSectionUnreadCount,
    getUnreadCount,
    markChatRead,
    registerOutgoingMessage,
  };

  return (
    <UnreadContext.Provider value={value}>
      {children}
    </UnreadContext.Provider>
  );
}

export const useUnread = () => {
  const context = useContext(UnreadContext);
  if (!context) {
    throw new Error('useUnread must be used within UnreadProvider');
  }
  return context;
};
