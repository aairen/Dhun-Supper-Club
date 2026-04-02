import React, { useState } from "react";
import { auth } from "../firebase";
import { sendPasswordResetEmail } from "firebase/auth";
import { Link } from "react-router-dom";
import { motion } from "motion/react";
import { Mail, ArrowLeft, CheckCircle, AlertCircle } from "lucide-react";

const ForgotPassword = () => {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess(false);

    try {
      await sendPasswordResetEmail(auth, email);
      setSuccess(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-80px)] flex items-center justify-center px-4 py-12 bg-neutral-50 dark:bg-neutral-950 transition-colors duration-300">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 p-8 shadow-sm"
      >
        <div className="mb-8">
          <Link 
            to="/auth" 
            className="flex items-center text-xs text-neutral-500 hover:text-neutral-900 dark:hover:text-white transition-colors uppercase tracking-widest font-bold"
          >
            <ArrowLeft className="w-3 h-3 mr-2" />
            Back to Sign In
          </Link>
        </div>

        <div className="text-center mb-8">
          <h2 className="text-3xl font-serif tracking-tight text-neutral-900 dark:text-white uppercase tracking-wider">
            Reset Password
          </h2>
          <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400 font-light">
            Enter your email address and we'll send you a link to reset your password.
          </p>
        </div>

        {success ? (
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-100 dark:border-green-900/30 p-6 text-center">
            <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
            <h3 className="text-green-800 dark:text-green-400 font-serif uppercase tracking-widest mb-2">Email Sent</h3>
            <p className="text-sm text-green-700 dark:text-green-500/80 leading-relaxed">
              We've sent a password reset link to <span className="font-bold">{email}</span>. Please check your inbox and follow the instructions.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/30 text-red-600 dark:text-red-400 text-xs rounded flex items-start">
                <AlertCircle className="w-4 h-4 mr-2 mt-0.5 flex-shrink-0" />
                {error}
              </div>
            )}

            <div className="space-y-1">
              <label className="text-xs font-semibold uppercase tracking-wider text-neutral-500">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                <input
                  type="email"
                  required
                  className="w-full pl-10 pr-4 py-2 border border-neutral-200 dark:border-neutral-800 bg-transparent dark:text-white focus:border-neutral-900 dark:focus:border-white outline-none transition-all text-sm"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 py-4 font-bold uppercase tracking-widest hover:bg-neutral-800 dark:hover:bg-neutral-100 transition-all disabled:opacity-50"
            >
              {loading ? "Sending..." : "Send Reset Link"}
            </button>
          </form>
        )}
      </motion.div>
    </div>
  );
};

export default ForgotPassword;
