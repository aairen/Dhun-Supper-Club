import React from "react";
import { Link } from "react-router-dom";
import { motion } from "motion/react";
import { ArrowRight, Star, Users, Calendar } from "lucide-react";

const Home = () => {
  return (
    <div className="flex flex-col">
      {/* Hero Section */}
      <section className="relative h-[80vh] md:h-[90vh] flex items-center justify-center overflow-hidden bg-neutral-900">
        <div className="absolute inset-0 z-0">
          <img 
            src="https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?auto=format&fit=crop&q=80&w=2070" 
            alt="Dhun Supper Club Hero" 
            className="w-full h-full object-cover opacity-40"
            referrerPolicy="no-referrer"
          />
        </div>
        
        <div className="relative z-10 text-center px-6 max-w-4xl mx-auto">
          <motion.h1 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="text-6xl sm:text-7xl md:text-9xl font-serif text-white tracking-tighter mb-2"
          >
            Dhun
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="text-base sm:text-lg md:text-2xl text-neutral-300 font-light uppercase tracking-[0.2em] md:tracking-[0.3em] mb-10 max-w-2xl mx-auto leading-relaxed"
          >
            Supper Club
          </motion.p>
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.4 }}
          >
            <Link 
              to="/events" 
              className="inline-flex items-center bg-white text-neutral-900 px-8 md:px-10 py-4 text-sm font-semibold uppercase tracking-widest hover:bg-neutral-100 transition-all group"
            >
              Book an Event
              <ArrowRight className="ml-3 w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Link>
          </motion.div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16 md:py-24 bg-neutral-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12 text-center">
            <div className="flex flex-col items-center">
              <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-sm mb-6">
                <Calendar className="w-6 h-6 text-neutral-900" />
              </div>
              <h5 className="text-lg font-serif mb-3 uppercase tracking-widest">Seamless Booking</h5>
              <p className="text-sm text-neutral-500 font-light leading-relaxed max-w-xs">
                Our intuitive credit-based system allows you to secure your seat with a single click.
              </p>
            </div>
            <div className="flex flex-col items-center">
              <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-sm mb-6">
                <Users className="w-6 h-6 text-neutral-900" />
              </div>
              <h5 className="text-lg font-serif mb-3 uppercase tracking-widest">Intimate Gatherings</h5>
              <p className="text-sm text-neutral-500 font-light leading-relaxed max-w-xs">
                Limited capacity events ensure a personalized and communal atmosphere for every guest.
              </p>
            </div>
            <div className="flex flex-col items-center">
              <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-sm mb-6">
                <Star className="w-6 h-6 text-neutral-900" />
              </div>
              <h5 className="text-lg font-serif mb-3 uppercase tracking-widest">Membership Rewards</h5>
              <p className="text-sm text-neutral-500 font-light leading-relaxed max-w-xs">
                Frequent diners earn exclusive status and priority access to our most sought-after events.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Experiences Section */}
      <section className="py-16 md:py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16 md:mb-20">
            <h2 className="text-xs font-semibold uppercase tracking-[0.3em] text-neutral-400 mb-4">The Collection</h2>
            <h3 className="text-3xl md:text-4xl font-serif text-neutral-900 uppercase tracking-widest">Experiences at Dhun</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-12 max-w-5xl mx-auto">
            {/* Grand Thali */}
            <motion.div 
              whileHover={{ y: -10 }}
              className="group"
            >
              <div className="aspect-[4/5] overflow-hidden mb-8 bg-neutral-100">
                <img 
                  src="https://images.unsplash.com/photo-1589302168068-964664d93dc0?auto=format&fit=crop&q=80&w=1974" 
                  alt="Grand Thali Experience" 
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                  referrerPolicy="no-referrer"
                />
              </div>
              <div className="text-center px-4">
                <h4 className="text-xl font-serif text-neutral-900 mb-3 uppercase tracking-wider">Grand Thali Experience</h4>
                <p className="text-sm text-neutral-500 font-light leading-relaxed mb-6">
                  Traditional, abundant, communal dining. A symphony of flavors served on a single platter, 
                  celebrating the richness of regional heritage.
                </p>
                <div className="flex items-center justify-center space-x-2 text-neutral-400 text-[10px] uppercase tracking-widest">
                  <Star className="w-3 h-3 fill-current" />
                  <span>6 Credits per person</span>
                  <Star className="w-3 h-3 fill-current" />
                </div>
              </div>
            </motion.div>

            {/* Tiffins & Toast */}
            <motion.div 
              whileHover={{ y: -10 }}
              className="group"
            >
              <div className="aspect-[4/5] overflow-hidden mb-8 bg-neutral-100">
                <img 
                  src="https://images.unsplash.com/photo-1513442542250-854d436a73f2?auto=format&fit=crop&q=80&w=1974" 
                  alt="Tiffins & Toast Brunch" 
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                  referrerPolicy="no-referrer"
                />
              </div>
              <div className="text-center px-4">
                <h4 className="text-xl font-serif text-neutral-900 mb-3 uppercase tracking-wider">Tiffins & Toast</h4>
                <p className="text-sm text-neutral-500 font-light leading-relaxed mb-6">
                  An Anglo-Indian brunch experience. A delightful fusion of colonial heritage and modern breakfast classics, 
                  served every Saturday afternoon.
                </p>
                <div className="flex items-center justify-center space-x-2 text-neutral-400 text-[10px] uppercase tracking-widest">
                  <Star className="w-3 h-3 fill-current" />
                  <span>4 Credits per person</span>
                  <Star className="w-3 h-3 fill-current" />
                </div>
              </div>
            </motion.div>

            {/* Curated Dining */}
            <motion.div 
              whileHover={{ y: -10 }}
              className="group"
            >
              <div className="aspect-[4/5] overflow-hidden mb-8 bg-neutral-100">
                <img 
                  src="https://images.unsplash.com/photo-1559339352-11d035aa65de?auto=format&fit=crop&q=80&w=1974" 
                  alt="Curated Dining" 
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                  referrerPolicy="no-referrer"
                />
              </div>
              <div className="text-center px-4">
                <h4 className="text-xl font-serif text-neutral-900 mb-3 uppercase tracking-wider">Curated Dining</h4>
                <p className="text-sm text-neutral-500 font-light leading-relaxed mb-6">
                  Seasonal, multi-course tasting experience. A modern interpretation of fine dining, 
                  where each course tells a story of craftsmanship.
                </p>
                <div className="flex items-center justify-center space-x-2 text-neutral-400 text-[10px] uppercase tracking-widest">
                  <Star className="w-3 h-3 fill-current" />
                  <span>7 Credits per person</span>
                  <Star className="w-3 h-3 fill-current" />
                </div>
              </div>
            </motion.div>

            {/* Hands-On Cooking */}
            <motion.div 
              whileHover={{ y: -10 }}
              className="group"
            >
              <div className="aspect-[4/5] overflow-hidden mb-8 bg-neutral-100">
                <img 
                  src="https://images.unsplash.com/photo-1556910103-1c02745aae4d?auto=format&fit=crop&q=80&w=1974" 
                  alt="Hands-On Cooking" 
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                  referrerPolicy="no-referrer"
                />
              </div>
              <div className="text-center px-4">
                <h4 className="text-xl font-serif text-neutral-900 mb-3 uppercase tracking-wider">Hands-On Cooking</h4>
                <p className="text-sm text-neutral-500 font-light leading-relaxed mb-6">
                  Learn to cook healthy home-style meals using fresh seasonal ingredients in an interactive 2-hour session.
                </p>
                <div className="flex items-center justify-center space-x-2 text-neutral-400 text-[10px] uppercase tracking-widest">
                  <Star className="w-3 h-3 fill-current" />
                  <span>4 Credits per person</span>
                  <Star className="w-3 h-3 fill-current" />
                </div>
              </div>
            </motion.div>
          </div>

          <div className="mt-20 text-center">
            <Link 
              to="/events" 
              className="inline-block border-b border-neutral-900 pb-1 text-sm font-semibold uppercase tracking-widest hover:text-neutral-500 hover:border-neutral-500 transition-all"
            >
              View Upcoming Calendar
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Home;
