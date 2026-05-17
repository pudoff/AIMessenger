import { Outlet } from 'react-router-dom';
import SidebarNav from '../components/SidebarNav';
import StoriesBar from '../components/StoriesBar';

function AppLayout() {
  return (
    <div className="app-shell">
      <SidebarNav />
      <div className="app-shell__content">
        {/* <StoriesBar /> */}
        <Outlet />
      </div>
    </div>
  );
}

export default AppLayout;
