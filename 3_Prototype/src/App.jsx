import { Navigate, Route, Routes } from 'react-router-dom';
import AppLayout from './layouts/AppLayout';
import AdminLayout from './layouts/AdminLayout';
import LoginPage from './pages/LoginPage';
import MessengerPage from './pages/MessengerPage';
import DirectChatsPage from './pages/DirectChatsPage';
import GroupChatsPage from './pages/GroupChatsPage';
import AssistantPage from './pages/AssistantPage';
import AdminPage from './pages/AdminPage';
import NotFoundPage from './pages/NotFoundPage';
import ContactsPage from './pages/ContactsPage';
import CommunitiesPage from './pages/CommunitiesPage';
import { RequireAuth, RequireGuest, RequireRole } from './components/guards/RouteGuards';

function App() {
  return (
    <Routes>
      <Route
        path="/"
        element={<Navigate to="/login" replace />}
      />
      <Route
        path="/login"
        element={
          <RequireGuest>
            <LoginPage />
          </RequireGuest>
        }
      />

      <Route
        path="/app"
        element={
          <RequireAuth>
            <RequireRole role="user">
              <AppLayout />
            </RequireRole>
          </RequireAuth>
        }
      >
        <Route index element={<MessengerPage />} />
        <Route path="direct" element={<DirectChatsPage />} />
        <Route path="groups" element={<GroupChatsPage />} />
        <Route path="communities" element={<CommunitiesPage />} />
        <Route path="contacts" element={<ContactsPage />} />
        <Route path="contacts/:contactId" element={<ContactsPage />} />
        <Route path="assistant" element={<AssistantPage />} />
      </Route>

      <Route
        path="/admin"
        element={
          <RequireAuth>
            <RequireRole role="admin">
              <AdminLayout />
            </RequireRole>
          </RequireAuth>
        }
      >
        <Route index element={<AdminPage />} />
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}

export default App;
