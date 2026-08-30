import React from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { SCORE_DISCLAIMER } from '../../lib/score';

const legal = [
  ['/about', 'About Us'],
  ['/contact', 'Contact'],
  ['/privacy-policy', 'Privacy Policy'],
  ['/terms', 'Terms of Service'],
  ['/disclaimer', 'Disclaimer'],
  ['/dealer-terms', 'Dealer Terms'],
  ['/seller-terms', 'Seller Terms'],
  ['/listing-rules', 'Listing Rules'],
  ['/fraud-warning', 'Fraud Warning'],
  ['/used-bike-safety', 'Used Bike Safety'],
  ['/document-privacy', 'Document Privacy'],
];

const explore = [
  ['/new-bikes', 'New Bikes'],
  ['/used-bikes', 'Used Bikes'],
  ['/upcoming-bikes', 'Upcoming Bikes'],
  ['/top-mileage-bikes', 'Top Mileage Bikes'],
  ['/compare', 'Compare Bikes'],
  ['/brands', 'Browse Brands'],
  ['/guides', 'Buying Guides'],
  ['/faq', 'FAQ'],
];

export default function Footer() {
  const { settings } = useApp();
  const brandName = settings['brand_name'] || 'CompareBike';
  const tagline = settings['tagline'] || "Find, compare and choose India's perfect bike.";
  return (
    <footer className="mt-12 border-t border-ink-800 bg-ink-900 text-ink-300">
      <div className="container-x grid gap-10 py-12 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10">
              <svg className="h-4.5 w-4.5 h-5 w-5 text-primary-500" viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 40c0-8 6-14 14-14h10l6-8h8l-7 10c4 3 6 8 6 12" />
                <circle cx="18" cy="44" r="7" />
                <circle cx="46" cy="44" r="7" />
                <path d="M25 44h14" />
              </svg>
            </span>
            <span className="text-lg font-extrabold text-white">{brandName}</span>
          </div>
          <p className="mt-3 text-sm leading-relaxed text-ink-400">{tagline}</p>
          <p className="mt-4 text-xs leading-relaxed text-ink-500">{SCORE_DISCLAIMER}</p>
        </div>
        <div>
          <h4 className="mb-3 text-sm font-bold uppercase tracking-wider text-white">Explore</h4>
          <ul className="space-y-2">
            {explore.map(([to, label]) => (
              <li key={to}>
                <Link to={to} className="text-sm text-ink-400 transition hover:text-primary-400">
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h4 className="mb-3 text-sm font-bold uppercase tracking-wider text-white">For Dealers & Sellers</h4>
          <ul className="space-y-2">
            <li><Link to="/dealer/register" className="text-sm text-ink-400 hover:text-primary-400">Dealer Registration</Link></li>
            <li><Link to="/post-used-bike" className="text-sm text-ink-400 hover:text-primary-400">Sell a Used Bike</Link></li>
            <li><Link to="/login" className="text-sm text-ink-400 hover:text-primary-400">Login</Link></li>
            <li><Link to="/register" className="text-sm text-ink-400 hover:text-primary-400">Create Account</Link></li>
          </ul>
          <h4 className="mb-3 mt-6 text-sm font-bold uppercase tracking-wider text-white">Trust & Safety</h4>
          <ul className="space-y-2">
            <li><Link to="/used-bike-safety" className="text-sm text-ink-400 hover:text-primary-400">Used Bike Safety Guide</Link></li>
            <li><Link to="/fraud-warning" className="text-sm text-ink-400 hover:text-primary-400">Fraud Warning</Link></li>
            <li><Link to="/document-privacy" className="text-sm text-ink-400 hover:text-primary-400">Document Privacy</Link></li>
          </ul>
        </div>
        <div>
          <h4 className="mb-3 text-sm font-bold uppercase tracking-wider text-white">Legal</h4>
          <ul className="grid grid-cols-2 gap-x-2 gap-y-2">
            {legal.map(([to, label]) => (
              <li key={to}>
                <Link to={to} className="text-sm text-ink-400 transition hover:text-primary-400">
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="border-t border-ink-800">
        <div className="container-x flex flex-col items-center justify-between gap-2 py-5 text-xs text-ink-500 sm:flex-row">
          <p>© {new Date().getFullYear()} {brandName}. All rights reserved. Made for Indian riders.</p>
          <p>Prices shown are indicative ex-showroom unless stated. Always verify with the dealer before purchase.</p>
        </div>
      </div>
    </footer>
  );
}
