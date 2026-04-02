import React, { useState, useEffect } from "react";
import { auth } from "../firebase";
import { confirmPasswordReset, verifyPasswordResetCode } from "firebase/auth";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import { motion } from "motion/react";
import { Lock, Eye, EyeOff, CheckCircle, AlertCircle, ArrowLeft } from "lucide-react";

const ResetPassword = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const oobCode = searchParams.get("oobCode");
  
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [email, setEmail] = useState("");

  useEffect(() => {
    const verifyCode = async () => {
      if (!oobCode) {
        setError("Invalid or missing reset code.");
        setVerifying(false);
        return;
      }

      try {
        const userEmail = await verifyPasswordResetCode(auth, oobCode);
        setEmail(userEmail);
      } catch (err: any) {
        setError("The reset link is invalid or has expired. Please request a new one.");
      } finally {
        setVerifying(false);
      }
    };

    verifyCode();
  }, [oobCode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (newPassword.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      if (!oobCode) throw new Error("Missing reset code.");
      await confirmPasswordReset(auth, oobCode, newPassword);
      setSuccess(true);
      setTimeout(() => navigate("/auth"), 3000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (verifying) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-50 dark:bg-neutral-950 transition-colors duration-300">
        <div className="text-neutral-500 dark:text-neutral-400 font-serif uppercase tracking-widest animate-pulse">
          Verifying Reset Link...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-80px)] flex items-center justify-center px-4 py-12 bg-neutral-50 dark:bg-neutral-950 transition-colors duration-300">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 p-8 shadow-sm"
      >
        <div className="text-center mb-8">
          <h2 className="text-3xl font-serif tracking-tight text-neutral-900 dark:text-white uppercase tracking-wider">
            New Password
          </h2>
          <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400 font-light">
            Set a new password for <span className="font-bold">{email}</span>
          </p>
        </div>

        {success ? (
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-100 dark:border-green-900/30 p-6 text-center">
            <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
            <h3 className="text-green-800 dark:text-green-400 font-serif uppercase tracking-widest mb-2">Password Reset</h3>
            <p className="text-sm text-green-700 dark:text-green-500/80 leading-relaxed">
              Your password has been successfully reset. Redirecting to sign in...
            </p>
          </div>
        ) : error ? (
          <div className="text-center">
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/30 p-6 mb-8">
              <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
              <p className="text-sm text-red-700 dark:text-red-400 leading-relaxed">
                {error}
              </p>
            </div>
            <Link 
              to="/forgot-password"
              className="inline-flex items-center text-xs font-bold uppercase tracking-widest text-neutral-900 dark:text-white border-b border-neutral-900 dark:border-white pb-1 hover:text-neutral-600 dark:hover:text-neutral-300 hover:border-neutral-600 dark:hover:border-neutral-300 transition-all"
            >
              Request New Link
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-1">
              <label className="text-xs font-semibold uppercase tracking-wider text-neutral-500">New Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  className="w-full pl-10 pr-12 py-2 border border-neutral-200 dark:border-neutral-800 bg-transparent dark:text-white focus:border-neutral-900 dark:focus:border-white outline-none transition-all text-sm"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Min 6 characters"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold uppercase tracking-wider text-neutral-500">Confirm Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  className="w-full pl-10 pr-12 py-2 border border-neutral-200 dark:border-neutral-800 bg-transparent dark:text-white focus:border-neutral-900 dark:focus:border-white outline-none transition-all text-sm"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repeat password"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 py-4 font-bold uppercase tracking-widest hover:bg-neutral-800 dark:hover:bg-neutral-100 transition-all disabled:opacity-50"
            >
              {loading ? "Updating..." : "Update Password"}
            </button>
          </form>
        )}
      </motion.div>
    </div>
  );
};

export default ResetPassword;
