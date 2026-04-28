import { Routes, Route, useLocation } from "react-router-dom";
import { AuthProvider } from "./components/AuthProvider";
import { ProtectedRoute } from "./components/ProtectedRoute";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Groups from "./pages/Groups";
import GroupDetail from "./pages/GroupDetail";
import JoinGroup from "./pages/JoinGroup";
import CreateMatch from "./pages/CreateMatch";
import CreateVenue from "./pages/CreateVenue";
import GroupSettings from "./pages/GroupSettings";
import MatchDetail from "./pages/MatchDetail";
import Matches from "./pages/Matches";
import Profile from "./pages/Profile";
import BottomNav from "./components/BottomNav";
import { useAuthStore } from "./stores/authStore";
import { useAppStore } from "./stores/appStore";
import { useEffect, useMemo } from "react";

function App() {
  const user = useAuthStore((state) => state.user);
  const theme = useAppStore((state) => state.theme);
  const location = useLocation();
  const isLoginPage = location.pathname === "/";

  const resolvedTheme = useMemo(() => {
    if (theme !== "system") return theme;
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }, [theme]);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", resolvedTheme === "dark");
  }, [resolvedTheme]);

  useEffect(() => {
    if (theme !== "system") return;
    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    const listener = (e: MediaQueryListEvent) => {
      document.documentElement.classList.toggle("dark", e.matches);
    };
    mql.addEventListener("change", listener);
    return () => mql.removeEventListener("change", listener);
  }, [theme]);

  return (
    <AuthProvider>
      <div className="min-h-screen bg-background flex flex-col">
        <main className="flex-1 pb-20">
          <Routes>
            <Route path="/" element={<Login />} />
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/groups"
              element={
                <ProtectedRoute>
                  <Groups />
                </ProtectedRoute>
              }
            />
            <Route
              path="/groups/:id"
              element={
                <ProtectedRoute>
                  <GroupDetail />
                </ProtectedRoute>
              }
            />
            <Route path="/groups/join" element={<JoinGroup />} />
            <Route
              path="/groups/:id/matches/create"
              element={
                <ProtectedRoute>
                  <CreateMatch />
                </ProtectedRoute>
              }
            />
            <Route
              path="/groups/:id/venues/create"
              element={
                <ProtectedRoute>
                  <CreateVenue />
                </ProtectedRoute>
              }
            />
            <Route
              path="/groups/:id/settings"
              element={
                <ProtectedRoute>
                  <GroupSettings />
                </ProtectedRoute>
              }
            />
            <Route
              path="/matches/:id"
              element={
                <ProtectedRoute>
                  <MatchDetail />
                </ProtectedRoute>
              }
            />
            <Route
              path="/matches"
              element={
                <ProtectedRoute>
                  <Matches />
                </ProtectedRoute>
              }
            />
            <Route
              path="/profile"
              element={
                <ProtectedRoute>
                  <Profile />
                </ProtectedRoute>
              }
            />
          </Routes>
        </main>
        {user && !isLoginPage && <BottomNav />}
      </div>
    </AuthProvider>
  );
}

export default App;
