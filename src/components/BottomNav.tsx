import type { FC } from "react";
import { NavLink } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Users, Calendar, User } from "lucide-react";

const BottomNav: FC = () => {
  const { t } = useTranslation();

  const navItems = [
    { to: "/groups", label: t("nav.groups"), icon: Users },
    { to: "/matches", label: t("nav.matches"), icon: Calendar },
    { to: "/profile", label: t("nav.profile"), icon: User },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-surface/80 backdrop-blur-md border-t border-border z-50">
      <div className="max-w-md mx-auto flex justify-around items-center h-16 pb-safe">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `flex flex-col items-center justify-center gap-1 w-16 h-full transition-colors active:scale-95 ${
                isActive
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`
            }
          >
            {({ isActive }) => (
              <>
                <item.icon className="w-6 h-6" strokeWidth={isActive ? 2.5 : 2} />
                <span className="text-xs font-medium">{item.label}</span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
};

export default BottomNav;
