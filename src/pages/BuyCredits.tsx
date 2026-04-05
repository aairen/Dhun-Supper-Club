import React, { useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useAuth } from "../components/AuthProvider";
import { motion } from "motion/react";
import { CreditCard, Plus, Minus, Info, CheckCircle, ArrowRight, Gift } from "lucide-react";
import { loadStripe } from "@stripe/stripe-js";
import { cn } from "../lib/utils";
import { AlertModal } from "../components/AlertModal";

const stripePromise = loadStripe((import.meta as any).env.VITE_STRIPE_PUBLIC_KEY || "pk_test_mock");

const BuyCredits = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { profile, user } = useAuth();
  
  const initialMissing = parseInt(searchParams.get("missing") || "0");
  const eventId = searchParams.get("eventId");
  const numPeople = searchParams.get("numPeople");
  
  const [credits, setCredits] = useState<number | string>(initialMissing > 0 ? initialMissing : 10);
  const [loading, setLoading] = useState(false);
  const [alertConfig, setAlertConfig] = useState<{ isOpen: boolean; title: string; message: string; variant: "error" | "info" | "success" }>({
    isOpen: false,
    title: "",
    message: "",
    variant: "info",
  });

  const pricePerCredit = 10;
  const taxRate = 0.0876;
  
  const bonusCredits = Math.floor(Number(credits) / 50) * 5;
  const subtotal = Number(credits) * pricePerCredit;
  const tax = subtotal * taxRate;
  const total = subtotal + tax;

  const handleAdjust = (direction: 'up' | 'down') => {
    const currentCredits = Number(credits);
    if (currentCredits % 5 !== 0) {
      if (direction === 'up') {
        setCredits(Math.ceil(currentCredits / 5) * 5);
      } else {
        setCredits(Math.floor(currentCredits / 5) * 5);
      }
    } else {
      setCredits(direction === 'up' ? currentCredits + 5 : Math.max(5, currentCredits - 5));
    }
  };

  const handlePurchase = async () => {
    if (!user) {
      navigate("/auth");
      return;
    }
    
    setLoading(true);
    try {
      const { doc, updateDoc, increment } = await import("firebase/firestore");
      const { db } = await import("../firebase");
      
      const userRef = doc(db, "users", user.uid);
      const totalCreditsToAdd = Number(credits) + bonusCredits;
      
      await updateDoc(userRef, {
        credits: increment(totalCreditsToAdd)
      });

      // If we came from a booking page, go back there
      if (eventId) {
        navigate(`/booking/${eventId}?numPeople=${numPeople}&success=true`);
      } else {
        navigate("/dashboard");
      }
    } catch (error: any) {
      console.error("Purchase error:", error);
      setAlertConfig({
        isOpen: true,
        title: "Error",
        message: "Failed to add credits. Please try again.",
        variant: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  const isDemoMode = !(import.meta as any).env.VITE_STRIPE_PUBLIC_KEY || (import.meta as any).env.VITE_STRIPE_PUBLIC_KEY === "YOUR_STRIPE_PUBLIC_KEY" || (import.meta as any).env.VITE_STRIPE_PUBLIC_KEY === "pk_test_mock";

  return (
    <div className="min-h-screen bg-neutral-50 py-12 md:py-24">
      <AlertModal
        isOpen={alertConfig.isOpen}
        onClose={() => setAlertConfig({ ...alertConfig, isOpen: false })}
        title={alertConfig.title}
        message={alertConfig.message}
        variant={alertConfig.variant}
      />
      <div className="max-w-4xl mx-auto px-4">
        
        <div className="text-center mb-12 md:mb-16">
          <h1 className="text-3xl md:text-4xl font-serif text-neutral-900 mb-4 uppercase tracking-widest">Credit Wallet</h1>
          <p className="text-sm md:text-base text-neutral-500 font-light">Purchase credits to book your next dining experience.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12">
          {/* Purchase Controls */}
          <div className="bg-white border border-neutral-200 p-6 md:p-8 shadow-sm space-y-8">
            <div className="space-y-4">
              <label className="text-xs font-semibold uppercase tracking-wider text-neutral-500">Select Amount</label>
              <div className="flex items-center justify-between bg-neutral-50 p-4 border border-neutral-100">
                <button 
                  onClick={() => handleAdjust('down')}
                  className="w-10 h-10 flex items-center justify-center bg-white border border-neutral-200 hover:bg-neutral-900 hover:text-white transition-all"
                >
                  <Minus className="w-4 h-4" />
                </button>
                <div className="text-center">
                  <input 
                    type="number"
                    value={credits}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === "") {
                        setCredits("");
                      } else {
                        setCredits(parseInt(val) || 0);
                      }
                    }}
                    onBlur={() => {
                      if (credits === "" || (typeof credits === 'number' && credits < 1)) {
                        setCredits(1);
                      }
                    }}
                    className="w-16 md:w-20 text-3xl md:text-4xl font-serif text-neutral-900 bg-transparent text-center focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                  <p className="text-[10px] text-neutral-400 uppercase tracking-widest">Credits</p>
                </div>
                <button 
                  onClick={() => handleAdjust('up')}
                  className="w-10 h-10 flex items-center justify-center bg-white border border-neutral-200 hover:bg-neutral-900 hover:text-white transition-all"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3 md:gap-4">
                {[10, 25, 50].map(amount => (
                  <div key={amount} className="relative">
                    {amount === 50 && (
                      <div className="absolute -top-6 left-1/2 -translate-x-1/2 flex items-center space-x-1 text-[8px] md:text-[10px] font-bold text-amber-600 uppercase tracking-widest bg-amber-50 px-2 py-0.5 rounded-full border border-amber-100 whitespace-nowrap">
                        <Gift className="w-2 md:w-3 h-2 md:h-3" />
                        <span>+5 bonus</span>
                      </div>
                    )}
                    <button
                      onClick={() => setCredits(amount)}
                      className={cn(
                        "w-full py-3 text-[10px] md:text-xs font-bold uppercase tracking-widest border transition-all",
                        Number(credits) === amount 
                          ? "bg-neutral-900 text-white border-neutral-900" 
                          : "bg-white text-neutral-500 border-neutral-200 hover:border-neutral-900"
                      )}
                    >
                      {amount}
                    </button>
                  </div>
                ))}
              </div>
              <p className="text-[10px] text-center text-amber-600 font-medium uppercase tracking-widest">
                Buy 50+ credits and get +5 bonus credits free!
              </p>
            </div>
          </div>

          {/* Order Summary */}
          <div className="bg-white border border-neutral-200 p-6 md:p-8 shadow-sm h-fit">
            <h2 className="text-lg md:text-xl font-serif mb-6 md:mb-8 uppercase tracking-widest">Order Summary</h2>
            
            <div className="space-y-4">
              <div className="flex justify-between text-sm">
                <span className="text-neutral-500">{credits} credits × $10</span>
                <span className="text-neutral-900">${subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-neutral-500">Tax</span>
                <span className="text-neutral-900">${tax.toFixed(2)}</span>
              </div>

              {bonusCredits > 0 && (
                <div className="flex justify-between text-sm text-amber-600 font-medium">
                  <div className="flex items-center">
                    <Gift className="w-3 h-3 mr-2" />
                    <span>Bonus Credits</span>
                  </div>
                  <span>+{bonusCredits}</span>
                </div>
              )}
              
              <div className="pt-4 border-t border-neutral-100">
                <div className="flex justify-between text-xl font-serif">
                  <span className="text-neutral-900">Total</span>
                  <span className="text-neutral-900">${total.toFixed(2)}</span>
                </div>
                <p className="mt-1 text-[10px] text-neutral-400 uppercase tracking-widest text-right">
                  Total credits: {Number(credits) + bonusCredits}
                </p>
              </div>

              <div className="pt-8">
                <button
                  onClick={handlePurchase}
                  disabled={loading}
                  className="w-full bg-neutral-900 text-white py-4 font-bold uppercase tracking-widest hover:bg-neutral-800 transition-all disabled:opacity-50 flex items-center justify-center group"
                >
                  {loading ? "Redirecting..." : "Checkout"}
                  <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </button>
              </div>

              <div className="flex items-start space-x-2 text-[10px] text-neutral-400 uppercase tracking-widest leading-relaxed pt-4">
                <Info className="w-3 h-3 mt-0.5 flex-shrink-0" />
                <p>Credits are non-refundable. Cancellations within 14 days of an event will not be credited back.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BuyCredits;
