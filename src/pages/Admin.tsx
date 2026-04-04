import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import AdminLayout from "../components/AdminLayout";
import AdminOverview from "./admin/Overview";
import AdminEvents from "./admin/Events";
import AdminBookings from "./admin/Bookings";
import AdminUsers from "./admin/Users";
import AdminMessages from "./admin/Messages";
import AdminRevenue from "./admin/Revenue";

const Admin = () => {
  return (
    <AdminLayout>
      <Routes>
        <Route path="/" element={<AdminOverview />} />
        <Route path="/events" element={<AdminEvents />} />
        <Route path="/bookings" element={<AdminBookings />} />
        <Route path="/users" element={<AdminUsers />} />
        <Route path="/revenue" element={<AdminRevenue />} />
        <Route path="/messages" element={<AdminMessages />} />
        {/* Fallback for legacy routes if any */}
        <Route path="/reservations" element={<Navigate to="/admin/bookings" replace />} />
        <Route path="/transactions" element={<Navigate to="/admin/revenue" replace />} />
      </Routes>
    </AdminLayout>
  );
};

export default Admin;
