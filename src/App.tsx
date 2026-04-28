import { Routes, Route } from "react-router-dom";
import { AuthProvider } from "./components/AuthProvider";
import { ProtectedRoute } from "./components/ProtectedRoute";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Groups from "./pages/Groups";
import GroupDetail from "./pages/GroupDetail";
import JoinGroup from "./pages/JoinGroup";
import CreateMatch from "./pages/CreateMatch";
import MatchDetail from "./pages/MatchDetail";
import Matches from "./pages/Matches";
import Profile from "./pages/Profile";
import BottomNav from "./components/BottomNav";
import { useAuthStore } from "./stores/authStore";

function App() {
  const user = useAuthStore((state) => state.user);

  return (
    <AuthProvider>
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <main className="flex-1 pb-16">
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
        {user && <BottomNav />}
      </div>
    </AuthProvider>
  );
}

export default App;
