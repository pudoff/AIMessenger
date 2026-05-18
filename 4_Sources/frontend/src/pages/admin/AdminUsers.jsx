import { useEffect, useState } from 'react';
import SectionHeader from '../../components/SectionHeader';
import { adminAPI } from '../../api/admin';

const formatUser = (user) => ({
  id: user.id,
  name: `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.username,
  email: user.email || '',
  role: user.role || 'user',
  is_active: user.is_active,
});

function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredUsers(users);
    } else {
      const query = searchQuery.toLowerCase();
      setFilteredUsers(
        users.filter(user =>
          user.name.toLowerCase().includes(query) ||
          user.email.toLowerCase().includes(query)
        )
      );
    }
  }, [searchQuery, users]);

  useEffect(() => {
    let mounted = true;

    const loadUsers = async () => {
      try {
        const list = await adminAPI.getUsers();

        if (!mounted) return;

        if (list.length) {
          const formattedUsers = list.map(formatUser);
          setUsers(formattedUsers);
          setFilteredUsers(formattedUsers);
        }
      } catch (err) {
        console.error('Ошибка загрузки пользователей:', err);
        setError('Не удалось загрузить пользователей');
      } finally {
        setLoading(false);
      }
    };

    loadUsers();
    return () => { mounted = false; };
  }, []);

  const handleToggleUserStatus = async (userId, currentStatus) => {
    const newStatus = !currentStatus;
    try {
      await adminAPI.updateUser(userId, { is_active: newStatus });
      setUsers(users.map(u => u.id === userId ? { ...u, is_active: newStatus } : u));
      setFilteredUsers(filteredUsers.map(u => u.id === userId ? { ...u, is_active: newStatus } : u));
    } catch (err) {
      console.error('Ошибка изменения статуса:', err);
      alert('Не удалось изменить статус пользователя');
    }
  };

  const handleChangeUserRole = async (userId, newRole) => {
    try {
      await adminAPI.updateUser(userId, { role: newRole });
      setUsers(users.map(u => u.id === userId ? { ...u, role: newRole } : u));
      setFilteredUsers(filteredUsers.map(u => u.id === userId ? { ...u, role: newRole } : u));
    } catch (err) {
      console.error('Ошибка изменения роли:', err);
      alert('Не удалось изменить роль пользователя');
    }
  };

  if (loading) return <div className="loading">Загрузка пользователей...</div>;
  if (error) return <div className="error">{error}</div>;

  return (
    <div className="admin-page">
      <SectionHeader title="Управление пользователями" subtitle="Просмотр, редактирование ролей и блокировка пользователей" />

      <article className="panel">
        <div className="panel__title panel__title--between">
          <span>Список пользователей</span>
          <input
            type="text"
            placeholder="Поиск по имени или email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="search-input"
          />
        </div>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Имя</th>
                <th>Email</th>
                <th>Роль</th>
                <th>Статус</th>
                <th>Действия</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan="5" style={{ textAlign: 'center', padding: '20px' }}>
                    {searchQuery ? 'Пользователи не найдены' : 'Список пользователей пуст'}
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => (
                  <tr key={user.id}>
                    <td>{user.name}</td>
                    <td>{user.email}</td>
                    <td>
                      <select
                        value={user.role}
                        onChange={(e) => handleChangeUserRole(user.id, e.target.value)}
                        className="role-select"
                      >
                        <option value="user">Пользователь</option>
                        <option value="admin">Администратор</option>
                      </select>
                    </td>
                    <td>{user.is_active ? 'Активен' : 'Заблокирован'}</td>
                    <td>
                      <button
                        className="secondary-button"
                        type="button"
                        onClick={() => handleToggleUserStatus(user.id, user.is_active)}
                      >
                        {user.is_active ? 'Заблокировать' : 'Разблокировать'}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </article>
    </div>
  );
}

export default AdminUsers;