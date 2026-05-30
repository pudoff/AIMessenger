import { Navigate, Route, Routes } from 'react-router-dom';

import AppLayout from './layouts/AppLayout';
import AdminLayout from './layouts/AdminLayout';

import LoginPage from './pages/auth/LoginPage';
import RegisterPage from './pages/auth/RegisterPage';
import ForgotPasswordPage from './pages/auth/ForgotPasswordPage';
import ResetPasswordPage from './pages/auth/ResetPasswordPage';

import CommunitiesPage from './pages/messenger/CommunitiesPage';
import MessengerPage from './pages/messenger/MessengerPage';
import DirectChatsPage from './pages/messenger/DirectChatsPage';
import GroupChatsPage from './pages/messenger/GroupChatsPage';
import ContactsPage from './pages/messenger/ContactsPage';
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminUsers from './pages/admin/AdminUsers';
import AdminChats from './pages/admin/AdminChats';
import AdminBroadcast from './pages/admin/AdminBroadcast';
import AssistantPage from './pages/assistant/AssistantPage';
import SettingsPage from './pages/SettingsPage';
import NotFoundPage from './pages/NotFoundPage';

import { RequireAuth, RequireGuest, RequireRole } from './components/guards/RouteGuards';

function App() {
  return (
    <Routes>

      {/* Вход */}
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route
        path="/login"
        element={
          <RequireGuest>
            <LoginPage />
          </RequireGuest>} />

      <Route
        path="/register"
        element={
          <RequireGuest>
            <RegisterPage />
          </RequireGuest>} />

      {/* Пользователь */}
      <Route
        path="/forgot-password"
        element={
          <RequireGuest>
            <ForgotPasswordPage />
          </RequireGuest>} />

      <Route
        path="/reset-password/:uidb64/:token"
        element={
          <RequireGuest>
            <ResetPasswordPage />
          </RequireGuest>} />

      <Route
        path="/app"
        element={
          <RequireAuth>
            <RequireRole role="user">
              <AppLayout />
            </RequireRole>
          </RequireAuth>}>

        <Route index element={<MessengerPage />} />
        <Route path="direct" element={<DirectChatsPage />} />
        <Route path="direct/:chatId" element={<DirectChatsPage />} />
        <Route path="groups" element={<GroupChatsPage />} />
        <Route path="groups/:chatId" element={<GroupChatsPage />} />
        <Route path="communities" element={<CommunitiesPage />} />
        <Route path="community/:communityId" element={<CommunitiesPage />} />
        <Route path="contacts" element={<ContactsPage />} />
        <Route path="contacts/:contactId" element={<ContactsPage />} />
        <Route path="assistant" element={<AssistantPage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>

      {/* Админ */}
      <Route
        path="/admin"
        element={
          <RequireAuth>
            <RequireRole role="admin">
              <AdminLayout />
            </RequireRole>
          </RequireAuth>}>

        <Route index element={<AdminDashboard />} />
        <Route path="users" element={<AdminUsers />} />
        <Route path="chats" element={<AdminChats />} />
        <Route path="broadcast" element={<AdminBroadcast />} />
      </Route>

      <Route path="*" element={<NotFoundPage />} />

    </Routes>
  );
}

export default App;
