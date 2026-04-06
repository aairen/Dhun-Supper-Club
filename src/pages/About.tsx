import React from "react";
import { motion } from "motion/react";

const About = () => {
  return (
    <div className="bg-white min-h-screen">
      {/* Header */}
      <section className="py-16 bg-neutral-50 border-b border-neutral-100">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl md:text-5xl font-serif text-neutral-900"
          >
            About Dhun Supper Club
          </motion.h1>
        </div>
      </section>

      {/* Content */}
      <section className="py-12">
        <div className="max-w-3xl mx-auto px-4 space-y-12">
          <div className="space-y-8 text-neutral-600 font-light leading-relaxed text-lg">
            <p>
              Dhun Supper Club is a celebration of food as an experience—one that brings people together through thoughtfully curated meals, meaningful conversation, and a deep respect for culinary tradition reimagined for today.
            </p>
            
            <p>
              At the heart of Dhun is founder Ruchi Airen, a passionate and imaginative home cook whose culinary journey spans over 35 years. Her philosophy is rooted in the belief that food should not only nourish but also inspire—encouraging us to rethink, reimagine, and reinvent the way we approach everyday cooking and dining.
            </p>

            <div className="aspect-square bg-neutral-100 overflow-hidden my-12 max-w-md mx-auto">
              <img 
                src="https://firebasestorage.googleapis.com/v0/b/gen-lang-client-0247572113.firebasestorage.app/o/ruchi.jpeg?alt=media&token=cf0923d5-8db4-4f1c-90df-161d93ea9237"
                alt="Founder of Dhun, Ruchi Airen" 
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            </div>

            <p>
              Ruchi’s approach blends the richness of traditional flavors with the creativity of modern techniques, creating menus that are both comforting and unexpected. Her work reflects a lifelong dedication to making food accessible, enjoyable, and deeply personal.
            </p>

            <p>
              Dhun Supper Club is an extension of this journey—designed for those who seek more than just a meal, but an experience centered around creativity, connection, and culture.
            </p>

            <p className="text-2xl font-serif text-neutral-900 pt-8">
              Welcome to Dhun.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
};

export default About;

