import React from "react";
import { HashRouter as Router, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "./components/AuthProvider";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import Home from "./pages/Home";
import Events from "./pages/Events";
import Booking from "./pages/Booking";
import ReservationDetails from "./pages/ReservationDetails";
import Dashboard from "./pages/Dashboard";
import Admin from "./pages/Admin";
import AdminRoute from "./components/AdminRoute";
import AuthPage from "./pages/Auth";
import About from "./pages/About";
import Contact from "./pages/Contact";
import BuyCredits from "./pages/BuyCredits";
import SettingsPage from "./pages/Settings";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";

const ProtectedRoute = ({ children, adminOnly = false }: { children: React.ReactNode, adminOnly?: boolean }) => {
  const { user, profile, loading, isAdmin } = useAuth();

  if (loading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  if (!user) return <Navigate to="/auth" />;
  if (adminOnly && !isAdmin) return <Navigate to="/" />;

  return <>{children}</>;
};


function AppRoutes() {
  const location = useLocation();

  React.useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
    const path = location.pathname;
    let title = "Dhun Supper Club";

    if (path === "/") title += " | Home";
    else if (path === "/events") title += " | Events";
    else if (path.startsWith("/booking/")) title += " | Booking";
    else if (path.startsWith("/reservation/")) title += " | Reservation";
    else if (path === "/dashboard") title += " | Dashboard";
    else if (path === "/auth") title += " | Sign In";
    else if (path === "/about") title += " | About";
    else if (path === "/contact") title += " | Contact";
    else if (path === "/buy-credits") title += " | Buy Credits";
    else if (path === "/settings") title += " | Settings";
    else if (path.startsWith("/admin")) title += " | Admin";
    else if (path === "/forgot-password") title += " | Forgot Password";
    else if (path === "/reset-password") title += " | Reset Password";

    document.title = title;
  }, [location]);

  return (
    <div className="flex flex-col min-h-screen bg-neutral-50 text-neutral-900 font-sans">
      <Navbar />
      <main className="flex-grow">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/events" element={<Events />} />
          <Route path="/auth" element={<AuthPage />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/about" element={<About />} />
          <Route path="/contact" element={<Contact />} />
          
          <Route path="/booking/:eventId" element={
            <ProtectedRoute>
              <Booking />
            </ProtectedRoute>
          } />
          
          <Route path="/reservation/:bookingId" element={
            <ProtectedRoute>
              <ReservationDetails />
            </ProtectedRoute>
          } />
          
          <Route path="/dashboard" element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          } />
          
          <Route path="/buy-credits" element={
            <ProtectedRoute>
              <BuyCredits />
            </ProtectedRoute>
          } />
          
          <Route path="/settings" element={
            <ProtectedRoute>
              <SettingsPage />
            </ProtectedRoute>
          } />
          
          <Route path="/admin/*" element={
            <AdminRoute>
              <Admin />
            </AdminRoute>
          } />
        </Routes>
      </main>
      <Footer />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <AppRoutes />
      </Router>
    </AuthProvider>
  );
}
