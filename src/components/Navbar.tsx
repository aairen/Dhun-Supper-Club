import React from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "./AuthProvider";
import { auth } from "../firebase";
import { signOut } from "firebase/auth";
import { Menu, X, User, LogOut, LayoutDashboard, Settings, CreditCard } from "lucide-react";
import { cn } from "../lib/utils";
import { motion, AnimatePresence } from "motion/react";
import NotificationBell from "./NotificationBell";

const Navbar = () => {
  const { user, profile, isAdmin } = useAuth();
  const [isOpen, setIsOpen] = React.useState(false);
  const [isProfileOpen, setIsProfileOpen] = React.useState(false);
  const profileRef = React.useRef<HTMLDivElement>(null);
  const location = useLocation();
  const navigate = useNavigate();

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setIsProfileOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogout = async () => {
    await signOut(auth);
    navigate("/");
  };

  const navLinks = [
    { name: "Home", path: "/" },
    { name: "Events", path: "/events" },
    { name: "About", path: "/about" },
    { name: "Contact", path: "/contact" },
  ];

  return (
    <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-neutral-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-20">
          <div className="flex items-center">
            <Link to="/" className="text-2xl font-serif tracking-widest text-neutral-900 uppercase">
              Dhun
            </Link>
          </div>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center space-x-8">
            {navLinks.map((link) => (
              <Link
                key={link.path}
                to={link.path}
                className={cn(
                  "text-sm font-medium tracking-wide transition-colors hover:text-neutral-600",
                  location.pathname === link.path ? "text-neutral-900 border-b-2 border-neutral-900" : "text-neutral-500"
                )}
              >
                {link.name}
              </Link>
            ))}

            {user && (
              <>
                <NotificationBell />
                <Link
                  to="/buy-credits"
                  className="flex items-center space-x-2 px-4 py-2 bg-neutral-100 hover:bg-neutral-200 transition-colors rounded-full"
                >
                  <CreditCard className="w-4 h-4 text-neutral-900" />
                  <span className="text-sm font-bold text-neutral-900">
                    {profile?.credits || 0} Credits
                  </span>
                </Link>
              </>
            )}

            {user ? (
              <div className="relative" ref={profileRef}>
                <button
                  onClick={() => setIsProfileOpen(!isProfileOpen)}
                  className="flex flex-col items-end group"
                >
                  <div className="flex items-center space-x-2 text-sm font-medium text-neutral-900 group-hover:text-neutral-600 transition-colors">
                    <span>Hello, {profile?.firstName || "User"}</span>
                    <User className="w-4 h-4" />
                  </div>
                  {isAdmin && (
                    <span className="text-[10px] font-bold text-red-600 uppercase tracking-wider leading-none mt-0.5">
                      Admin
                    </span>
                  )}
                </button>

                <AnimatePresence>
                  {isProfileOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      className="absolute right-0 mt-2 w-48 bg-white border border-neutral-200 rounded-lg shadow-xl py-2"
                    >
                      {!isAdmin ? (
                        <Link
                          to="/dashboard"
                          className="flex items-center px-4 py-2 text-sm text-neutral-700 hover:bg-neutral-50"
                          onClick={() => setIsProfileOpen(false)}
                        >
                          <LayoutDashboard className="w-4 h-4 mr-2" />
                          Dashboard
                        </Link>
                      ) : (
                        <Link
                          to="/admin"
                          className="flex items-center px-4 py-2 text-sm text-neutral-700 hover:bg-neutral-50"
                          onClick={() => setIsProfileOpen(false)}
                        >
                          <LayoutDashboard className="w-4 h-4 mr-2" />
                          Admin
                        </Link>
                      )}
                      <Link
                        to="/settings"
                        className="flex items-center px-4 py-2 text-sm text-neutral-700 hover:bg-neutral-50"
                        onClick={() => setIsProfileOpen(false)}
                      >
                        <Settings className="w-4 h-4 mr-2" />
                        Settings
                      </Link>
                      <button
                        onClick={handleLogout}
                        className="w-full flex items-center px-4 py-2 text-sm text-red-600 hover:bg-neutral-50"
                      >
                        <LogOut className="w-4 h-4 mr-2" />
                        Logout
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ) : (
              <Link
                to="/auth"
                className="text-sm font-medium text-neutral-900 border border-neutral-900 px-6 py-2 hover:bg-neutral-900 hover:text-white transition-all"
              >
                Sign In
              </Link>
            )}
          </div>

          {/* Mobile menu button and NotificationBell */}
          <div className="md:hidden flex items-center space-x-4">
            {user && <NotificationBell />}
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="text-neutral-900 hover:text-neutral-600 focus:outline-none"
            >
              {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Nav */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden bg-white border-t border-neutral-100 overflow-hidden"
          >
            <div className="px-6 py-10 space-y-8">
              {navLinks.map((link) => (
                <Link
                  key={link.path}
                  to={link.path}
                  onClick={() => setIsOpen(false)}
                  className="block text-xl font-serif text-neutral-900 uppercase tracking-widest"
                >
                  {link.name}
                </Link>
              ))}
              
              {user ? (
                <div className="space-y-8 pt-8 border-t border-neutral-100">
                  <div className="flex items-center justify-between">
                    <Link
                      to="/buy-credits"
                      onClick={() => setIsOpen(false)}
                      className="flex items-center space-x-2 text-xs font-bold text-neutral-900 uppercase tracking-widest"
                    >
                      <CreditCard className="w-4 h-4" />
                      <span>{profile?.credits || 0} Credits</span>
                    </Link>
                    <Link 
                      to="/buy-credits" 
                      onClick={() => setIsOpen(false)}
                      className="text-[10px] font-bold uppercase tracking-widest border-b border-neutral-900"
                    >
                      Add
                    </Link>
                  </div>

                  <div className="space-y-6">
                    {!isAdmin ? (
                      <Link
                        to="/dashboard"
                        onClick={() => setIsOpen(false)}
                        className="block text-lg font-serif text-neutral-900 uppercase tracking-widest"
                      >
                        Dashboard
                      </Link>
                    ) : (
                      <Link
                        to="/admin"
                        onClick={() => setIsOpen(false)}
                        className="block text-lg font-serif text-neutral-900 uppercase tracking-widest"
                      >
                        Admin
                      </Link>
                    )}
                    <Link
                      to="/settings"
                      onClick={() => setIsOpen(false)}
                      className="block text-lg font-serif text-neutral-900 uppercase tracking-widest"
                    >
                      Settings
                    </Link>
                    <button
                      onClick={() => {
                        handleLogout();
                        setIsOpen(false);
                      }}
                      className="block text-lg font-serif text-red-600 uppercase tracking-widest"
                    >
                      Logout
                    </button>
                  </div>
                </div>
              ) : (
                <div className="pt-8 border-t border-neutral-100">
                  <Link
                    to="/auth"
                    onClick={() => setIsOpen(false)}
                    className="block w-full bg-neutral-900 text-white py-4 text-center text-xs font-bold uppercase tracking-widest"
                  >
                    Sign In
                  </Link>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
};

export default Navbar;
