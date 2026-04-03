import React, { useState } from "react";
import { motion } from "motion/react";
import { Mail, Phone, MapPin, Send } from "lucide-react";
import { db } from "../firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { useAuth } from "../components/AuthProvider";

const Contact = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [formData, setFormData] = useState({
    subject: "",
    email: "",
    body: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      await addDoc(collection(db, "messages"), {
        userId: user?.uid || "anonymous",
        subject: formData.subject,
        email: formData.email,
        body: formData.body,
        status: "unread",
        createdAt: serverTimestamp(),
      });
      setSuccess(true);
      setFormData({ subject: "", email: "", body: "" });
    } catch (error) {
      console.error("Error sending message:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white min-h-screen">
      <section className="py-24 bg-neutral-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h1 className="text-4xl font-serif text-neutral-900 mb-4">Contact Dhun</h1>
            <p className="text-neutral-500 font-light max-w-2xl mx-auto">
              Have questions about our experiences, membership, or a private event? 
              Reach out and our team will get back to you shortly.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
            {/* Contact Info */}
            <div className="lg:col-span-1 space-y-8">
              <div className="flex items-start space-x-4">
                <div className="w-10 h-10 bg-neutral-900 rounded-full flex items-center justify-center flex-shrink-0">
                  <Mail className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-neutral-900 mb-1">Email</h3>
                  <p className="text-neutral-500 font-light">contact@dhunsupperclub.com</p>
                </div>
              </div>

              <div className="flex items-start space-x-4">
                <div className="w-10 h-10 bg-neutral-900 rounded-full flex items-center justify-center flex-shrink-0">
                  <Phone className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-neutral-900 mb-1">Phone</h3>
                  <p className="text-neutral-500 font-light">(XXX) XXX-XXXX</p>
                </div>
              </div>

              <div className="flex items-start space-x-4">
                <div className="w-10 h-10 bg-neutral-900 rounded-full flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line></svg>
                </div>
                <div>
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-neutral-900 mb-1">Instagram</h3>
                  <p className="text-neutral-500 font-light">@dhunsupperclub</p>
                </div>
              </div>
            </div>

            {/* Contact Form */}
            <div className="lg:col-span-2 bg-white border border-neutral-200 p-8 shadow-sm">
              {success ? (
                <div className="text-center py-12">
                  <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-6">
                    <Send className="w-6 h-6 text-green-600" />
                  </div>
                  <h3 className="text-2xl font-serif text-neutral-900 mb-2">Message Sent</h3>
                  <p className="text-neutral-500 font-light mb-8">
                    Thank you for reaching out. We will respond to your inquiry as soon as possible.
                  </p>
                  <button 
                    onClick={() => setSuccess(false)}
                    className="text-sm font-semibold uppercase tracking-widest border-b border-neutral-900 pb-1"
                  >
                    Send another message
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-1">
                      <label className="text-xs font-semibold uppercase tracking-wider text-neutral-500">Subject</label>
                      <input
                        type="text"
                        required
                        className="w-full px-4 py-3 border border-neutral-200 focus:border-neutral-900 outline-none transition-all text-sm"
                        placeholder="How can we help you?"
                        value={formData.subject}
                        onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-semibold uppercase tracking-wider text-neutral-500">Email Address</label>
                      <input
                        type="email"
                        required
                        className="w-full px-4 py-3 border border-neutral-200 focus:border-neutral-900 outline-none transition-all text-sm"
                        placeholder="your@email.com"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold uppercase tracking-wider text-neutral-500">Message</label>
                    <textarea
                      required
                      rows={6}
                      className="w-full px-4 py-3 border border-neutral-200 focus:border-neutral-900 outline-none transition-all text-sm resize-none"
                      placeholder="Your message here..."
                      value={formData.body}
                      onChange={(e) => setFormData({ ...formData, body: e.target.value })}
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="bg-neutral-900 text-white px-10 py-4 text-sm font-semibold uppercase tracking-widest hover:bg-neutral-800 transition-all disabled:opacity-50"
                  >
                    {loading ? "Sending..." : "Send Message"}
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Contact;
