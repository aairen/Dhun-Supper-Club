import React from "react";
import { Link } from "react-router-dom";

import { Instagram } from "lucide-react";

const Footer = () => {
  return (
    <footer className="bg-neutral-900 text-neutral-400 py-12 border-t border-neutral-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12">
          <div className="col-span-1 md:col-span-2">
            <Link to="/" className="text-2xl font-serif tracking-widest text-white uppercase">
              Dhun
            </Link>
            <p className="mt-4 text-sm max-w-xs leading-relaxed">
              Curated dining experiences that celebrate tradition, abundance, and seasonal multi-course tasting menus.
            </p>
          </div>
          
          <div>
            <h3 className="text-white text-sm font-semibold uppercase tracking-wider mb-4">Quick Links</h3>
            <ul className="space-y-2 text-sm">
              <li><Link to="/events" className="hover:text-white transition-colors">Events</Link></li>
              <li><Link to="/about" className="hover:text-white transition-colors">About Us</Link></li>
              <li><Link to="/contact" className="hover:text-white transition-colors">Contact</Link></li>
              <li><Link to="/auth" className="hover:text-white transition-colors">Sign In</Link></li>
            </ul>
          </div>
          
          <div>
            <h3 className="text-white text-sm font-semibold uppercase tracking-wider mb-4">Contact</h3>
            <ul className="space-y-2 text-sm">
              <li>contact@dhunsupperclub.com</li>
              <li>(XXX) XXX-XXXX</li>
              <li className="pt-4">
                <div className="flex space-x-4">
                  <a href="https://instagram.com" target="_blank" rel="noopener noreferrer" className="text-neutral-400 hover:text-white transition-colors">
                    <Instagram className="w-5 h-5" />
                  </a>
                </div>
              </li>
            </ul>
          </div>
        </div>
        
        <div className="mt-12 pt-8 border-t border-neutral-800 text-xs text-center">
          <p>&copy; {new Date().getFullYear()} Dhun Supper Club. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
