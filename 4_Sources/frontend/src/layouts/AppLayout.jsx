import { Outlet } from 'react-router-dom';
import SidebarNav from '../components/SidebarNav';

function AppLayout() {
  return (
    <div className="app-shell">
      <SidebarNav />
      <div className="app-shell__content">
        {/* StoriesBar отключен до следующей итерации MVP. */}
        <Outlet />
      </div>
    </div>
  );
}

export default AppLayout;
