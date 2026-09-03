import React from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { useSEO } from '../lib/seo';

/**
 * /about — honest about page. No invented company history or fake stats.
 */
export default function AboutPage() {
  const { settings } = useApp();
  const name = (settings['brand_name'] as string) || 'CompareBike';
  const tagline = (settings['tagline'] as string) || 'Find, Compare & Choose Your Perfect Bike';

  useSEO({ title: `About ${name}`, description: `What ${name} is, how the CompareBike Score works, and what we will never do to make data look better.` });

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-3xl font-black text-ink-900">About {name}</h1>
      <p className="mt-2 text-lg text-ink-500">{tagline}</p>

      <div className="prose-bike mt-8">
        <p className="my-3 text-[15px] leading-relaxed text-ink-700">
          {name} is a motorcycle comparison and marketplace for India. We help you <strong>find</strong> the right bike (by fuel, budget and use),{' '}
          <strong>compare</strong> up to four bikes side by side with a transparent score, and <strong>choose</strong> with confidence — including buying from
          private sellers and verified dealers.
        </p>

        <h2 className="mb-2 mt-7 text-xl font-black text-ink-900">How the CompareBike Score works</h2>
        <p className="my-3 text-[15px] leading-relaxed text-ink-700">
          The Score is an estimate from 0 to 100 built only from published specifications, blended across six weighted categories: performance, mileage,
          safety, features, comfort and value. Weights are public and editable by the site admin. If a bike is missing data, it scores on what's available
          and is clearly labelled. <strong>The Score never invents numbers.</strong>
        </p>

        <h2 className="mb-2 mt-7 text-xl font-black text-ink-900">What we never do</h2>
        <p className="my-1 flex gap-2 pl-1 text-[15px] leading-relaxed text-ink-700"><span className="mt-[9px] h-1.5 w-1.5 shrink-0 rounded-full bg-primary-500" />We don't fabricate prices, mileage or launch dates — missing data shows as "N/A".</p>
        <p className="my-1 flex gap-2 pl-1 text-[15px] leading-relaxed text-ink-700"><span className="mt-[9px] h-1.5 w-1.5 shrink-0 rounded-full bg-primary-500" />We don't mark documents "verified" until a human admin has checked them.</p>
        <p className="my-1 flex gap-2 pl-1 text-[15px] leading-relaxed text-ink-700"><span className="mt-[9px] h-1.5 w-1.5 shrink-0 rounded-full bg-primary-500" />We don't show dealer offers publicly without approval.</p>
        <p className="my-1 flex gap-2 pl-1 text-[15px] leading-relaxed text-ink-700"><span className="mt-[9px] h-1.5 w-1.5 shrink-0 rounded-full bg-primary-500" />We don't hide a missing specification in a comparison — it shows N/A, never blank space.</p>

        <h2 className="mb-2 mt-7 text-xl font-black text-ink-900">Marketplace safety</h2>
        <p className="my-3 text-[15px] leading-relaxed text-ink-700">
          Used listings go through an approval workflow before they're public. Sellers upload proof documents (RC, insurance) to a <strong>private</strong>{' '}
          storage bucket visible only to the owner and approved admins. Dealers must apply and be verified before any of their offers can appear.
          Anything suspicious can be <Link to="/contact" className="font-bold text-primary-600 hover:underline">reported</Link> by any visitor.
        </p>

        <div className="mt-10 flex flex-wrap gap-3">
          <Link to="/" className="rounded-xl bg-primary-600 px-5 py-2.5 text-sm font-black text-white hover:bg-primary-700">Start comparing</Link>
          <Link to="/guides" className="rounded-xl border border-ink-300 bg-white px-5 py-2.5 text-sm font-black text-ink-700 hover:bg-ink-50">Read the guides</Link>
          <Link to="/post-used-bike" className="rounded-xl border border-ink-300 bg-white px-5 py-2.5 text-sm font-black text-ink-700 hover:bg-ink-50">Sell your bike</Link>
        </div>
      </div>
    </div>
  );
}
