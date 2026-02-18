import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { WatchPage } from "../pages/watch/ui/WatchPage";
import { BrowsePage } from "../pages/browse/ui/BrowsePage";
import { LoginPage } from "../pages/auth/ui/LoginPage";
import { SignupPage } from "../pages/auth/ui/SignupPage";
import { Header } from "../widgets/header/ui/Header";
import { isAuthenticated } from "../shared/lib/auth";
import "./index.css";

function PrivateRoute({ children }: { children: React.ReactNode }) {
  return isAuthenticated() ? <>{children}</> : <Navigate to="/login" replace />;
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/login"
          element={
            <>
              <Header />
              <LoginPage />
            </>
          }
        />
        <Route
          path="/signup"
          element={
            <>
              <Header />
              <SignupPage />
            </>
          }
        />
        <Route
          path="/browse"
          element={
            <PrivateRoute>
              <Header />
              <BrowsePage />
            </PrivateRoute>
          }
        />
        <Route
          path="/watch"
          element={
            <PrivateRoute>
              <Header />
              <WatchPage />
            </PrivateRoute>
          }
        />
        <Route path="/" element={<Navigate to="/browse" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;

