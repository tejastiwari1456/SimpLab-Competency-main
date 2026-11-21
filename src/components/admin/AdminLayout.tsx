import React from 'react';
import { CurrentUser } from '../../types';
import { AppShell } from '../navigation/AppShell';
import { AdminDashboardView } from './AdminDashboardView';
import { AdminUsersView } from './AdminUsersView';
import { AdminAuditLogsView } from './AdminAuditLogsView';
import { AdminInstitutionsView } from './AdminInstitutionsView';
import { AdminSettingsView } from './AdminSettingsView';
import { AdminProfileView } from './AdminProfileView';

interface AdminLayoutProps {
  currentUser: CurrentUser;
  currentPath: string;
  onNavigate: (path: string) => void;
  onLogout: () => void;
  isDark: boolean;
  onToggleDarkMode: () => void;
  token: string | null;
}

export const AdminLayout: React.FC<AdminLayoutProps> = ({
  currentUser,
  currentPath,
  onNavigate,
  onLogout,
  isDark,
  onToggleDarkMode,
  token,
}) => {
  const renderAdminView = () => {
    switch (currentPath) {
      case '/admin/users':
        return <AdminUsersView token={token} />;
      case '/admin/audit':
        return <AdminAuditLogsView token={token} />;
      case '/admin/institutions':
        return <AdminInstitutionsView />;
      case '/admin/settings':
        return <AdminSettingsView />;
      case '/admin/profile':
        return <AdminProfileView currentUser={currentUser} />;
      case '/admin/dashboard':
      case '/admin':
      default:
        return (
          <AdminDashboardView
            currentUser={currentUser}
            onNavigate={onNavigate}
            token={token}
          />
        );
    }
  };

  return (
    <AppShell
      id="admin-application-shell"
      currentRole="admin"
      currentUser={currentUser}
      currentPath={currentPath}
      onNavigate={onNavigate}
      onLogout={onLogout}
      isDark={isDark}
      onToggleDarkMode={onToggleDarkMode}
    >
      {renderAdminView()}
    </AppShell>
  );
};
