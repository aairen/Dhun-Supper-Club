import React from "react";
import { Link, useLocation } from "react-router-dom";
import { 
  LayoutDashboard, 
  Calendar, 
  Users, 
  Users2, 
  DollarSign, 
  ArrowLeft 
} from "lucide-react";
import { cn } from "../lib/utils";

const AdminLayout = ({ children }: { children: React.ReactNode }) => {
  const location = useLocation();

  const adminLinks = [
    { name: "Overview", path: "/admin", icon: LayoutDashboard },
    { name: "Events", path: "/admin/events", icon: Calendar },
    { name: "Bookings", path: "/admin/bookings", icon: Users },
    { name: "Users", path: "/admin/users", icon: Users2 },
    { name: "Revenue", path: "/admin/revenue", icon: DollarSign },
  ];

  return (
    <div className="min-h-screen bg-neutral-50 flex">
      {/* Admin Sidebar */}
      <aside className="w-64 bg-white border-r border-neutral-200 hidden lg:flex flex-col sticky top-0 h-screen">
        <div className="p-8 flex-grow">
          <div className="flex items-center space-x-2 mb-8">
            <Link to="/dashboard" className="text-neutral-400 hover:text-neutral-900 transition-colors">
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <h2 className="text-xs font-bold uppercase tracking-widest text-neutral-400">Admin Console</h2>
          </div>
          
          <nav className="space-y-1">
            {adminLinks.map(link => (
              <Link
                key={link.path}
                to={link.path}
                className={cn(
                  "flex items-center px-4 py-3 text-sm font-medium transition-all rounded-md",
                  location.pathname === link.path 
                    ? "bg-neutral-900 text-white" 
                    : "text-neutral-500 hover:bg-neutral-50"
                )}
              >
                <link.icon className="w-4 h-4 mr-3" />
                {link.name}
              </Link>
            ))}
          </nav>
        </div>
        
        <div className="p-8 border-t border-neutral-100">
          <Link 
            to="/dashboard" 
            className="text-[10px] font-bold uppercase tracking-widest text-neutral-400 hover:text-neutral-900 transition-colors"
          >
            Exit Admin
          </Link>
        </div>
      </aside>

      {/* Mobile Nav (Simple) */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-neutral-200 z-50 flex justify-around p-2">
        {adminLinks.map(link => (
          <Link
            key={link.path}
            to={link.path}
            className={cn(
              "p-3 rounded-md",
              location.pathname === link.path ? "text-neutral-900" : "text-neutral-400"
            )}
          >
            <link.icon className="w-5 h-5" />
          </Link>
        ))}
      </div>

      {/* Admin Content */}
      <main className="flex-grow p-4 md:p-8 pb-24 lg:pb-8">
        <div className="max-w-6xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
};

export default AdminLayout;
