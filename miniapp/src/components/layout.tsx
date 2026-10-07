import React from "react";
import { BottomNavigation, Icon } from "zmp-ui";
import { useLocation, useNavigate } from "zmp-ui";
import { NAV_ITEMS } from "../constants";

export const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();

  const currentPath = location.pathname;
  // Place detail page does not show bottom navigation
  const showBottomNav = currentPath === "/" || currentPath === "/explore" || currentPath === "/chat";

  return (
    <div style={{ minHeight: "100vh", position: "relative" }}>
      <div className={showBottomNav ? "page-content-padding" : ""}>{children}</div>

      {showBottomNav && (
        <BottomNavigation
          fixed
          activeKey={currentPath}
          onChange={(key) => navigate(key)}
        >
          {NAV_ITEMS.map((item) => (
            <BottomNavigation.Item
              key={item.key}
              label={item.label}
              icon={<Icon icon={item.icon as any} />}
              linkTo={item.linkTo}
            />
          ))}
        </BottomNavigation>
      )}
    </div>
  );
};
