import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { createDealerApplication, getMyDealer, getBrands, getDealerDocs } from '../../lib/api';
import type { Brand, DealerProfile } from '../../lib/types';
import { getBrands as loadBrands } from '../../lib/api';
import { Button, Card, ErrorBlock, Field, Input, LoadingBlock, Select, StatusBadge, Textarea } from '../../components/ui';
import { DocUploader, type DraftDoc } from '../../components/uploaders';

const STATES = ['Andhra Pradesh','Assam','Bihar','Chhattisgarh','Delhi','Goa','Gujarat','Haryana','Himachal Pradesh','Jharkhand','Karnataka','Kerala','Madhya Pradesh','Maharashtra','Odisha','Punjab','Rajasthan','Tamil Nadu','Telangana','Uttar Pradesh','Uttarakhand','West Bengal','Other'];

/**
 * /dealer/register — dealer application (requires login).
 * The application goes to admin verification; only APPROVED dealers can
 * publish offers.
 */
export default function DealerRegister() {
  const { isAuthed, authLoading, profile, toast } = useApp();
  const navigate = useNavigate();
  const [existing, setExisting] = useState<DealerProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [docs, setDocs] = useState<DraftDoc[]>([]);

  const [dealerName, setDealerName] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [pincode, setPincode] = useState('');
  const [gst, setGst] = useState('');
  const [brandSel, setBrandSel] = useState<string[]>([]);
  const [website, setWebsite] = useState('');
  const [details, setDetails] = useState('');

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthed) navigate(`/login?redirect=${encodeURIComponent('/dealer/register')}`, { replace: true });
  }, [isAuthed, authLoading, navigate]);

  useEffect(() => {
    loadBrands().then(setBrands).catch(() => null);
    (async () => {
      try {
        const d = await getMyDealer();
        if (d) {
          setExisting(d);
          setDealerName(d.dealer_name);
          setBusinessName(d.business_name || '');
          setContactPerson(d.contact_person || '');
          setEmail(d.email || '');
          setPhone(d.phone || '');
          setAddress(d.address || '');
          setCity(d.city || '');
          setState(d.state || '');
          setPincode(d.pincode || '');
          setGst(d.gst_number || '');
          setBrandSel(d.brands || []);
          setWebsite(d.website || '');
          if (d.status === 'waiting' || d.status === 'rejected') {
            const ds = await getDealerDocs(d.id).catch(() => []);
            setDocs(ds.map((doc) => ({ id: doc.id, doc_type: doc.doc_type, label: doc.label || '', url: null, path: doc.storage_path, file: null, mime: doc.mime_type || '', size: doc.file_size || 0, recordId: doc.id })));
          }
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (authLoading || loading) return <LoadingBlock />;
  if (!isAuthed) return null;

  // already applied
  if (existing) {
    const dDocs = existing.status === 'waiting' || existing.status === 'rejected' ? docs : [];
    return (
      <div className="container-x max-w-3xl py-8">
        <h1 className="text-3xl font-black text-ink-900">Dealer Application</h1>
        <p className="mt-1 mb-6 text-sm text-ink-500">Your application status with the admin team:</p>
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <p className="text-lg font-bold text-ink-900">{existing.dealer_name}</p>
            <StatusBadge status={existing.status} />
          </div>
          <p className="mt-1 text-sm text-ink-500">
            Applied {new Date(existing.created_at).toLocaleDateString('en-IN')} · {existing.city}{existing.state ? `, ${existing.state}` : ''}
          </p>
          {existing.reject_reason && (
            <p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
              <strong>Why:</strong> {existing.reject_reason}
            </p>
          )}
          <div className="mt-4 space-y-2 text-sm text-ink-600">
            <p><strong>Business:</strong> {existing.business_name || 'N/A'}</p>
            <p><strong>Contact:</strong> {existing.contact_person || 'N/A'} · {existing.phone || 'N/A'}</p>
            <p><strong>Email:</strong> {existing.email || 'N/A'}</p>
            <p><strong>Brands:</strong> {existing.brands?.length ? existing.brands.join(', ') : 'N/A'}</p>
            <p><strong>GST:</strong> {existing.gst_number || 'Not provided'}</p>
          </div>
          {(existing.status === 'waiting' || existing.status === 'rejected') && (
            <div className="mt-5 border-t border-ink-100 pt-5">
              <h3 className="mb-3 font-bold text-ink-900">Update your application</h3>
              <DocUploader docs={dDocs} onChange={setDocs} pathPrefix={`dealer/${existing.user_id}`} />
              <div className="mt-4 flex justify-end">
                <Button
                  variant="primary"
                  loading={busy}
                  onClick={async () => {
                    setBusy(true);
                    setError(null);
                    try {
                      const sb = (await import('../../lib/supabase')).requireSupabase();
                      // persist any newly uploaded proof docs
                      for (const d of docs) {
                        if (!d.recordId && d.path) {
                          await sb.from('dealer_documents').insert({
                            dealer_id: existing.id,
                            doc_type: d.doc_type,
                            label: d.label,
                            bucket: 'private-documents',
                            storage_path: d.path,
                            mime_type: d.mime,
                            file_size: d.size,
                          });
                        }
                      }
                      // resubmit (RLS only allows this from waiting/rejected status)
                      await sb.from('dealer_profiles').update({ status: 'waiting', reject_reason: null }).eq('id', existing.id);
                      toast('Application resubmitted for review.', 'success');
                      const d = await getMyDealer();
                      setExisting(d);
                    } catch (e: any) {
                      setError(e.message || 'Could not update the application.');
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  Resubmit for review
                </Button>
              </div>
            </div>
          )}
          {existing.status === 'approved' && (
            <div className="mt-5 border-t border-ink-100 pt-5">
              <p className="text-sm font-semibold text-emerald-700">✓ You are an approved dealer.</p>
              <Link to="/dealer" className="mt-3 inline-block rounded-lg bg-primary-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-primary-700">Go to Dealer Dashboard →</Link>
            </div>
          )}
          {existing.status === 'suspended' && (
            <p className="mt-5 rounded-lg bg-red-50 p-3 text-sm text-red-700">
              Your dealer account is currently suspended. Contact support to resolve this.
            </p>
          )}
        </Card>
      </div>
    );
  }

  const toggleBrand = (name: string) => {
    setBrandSel((prev) => (prev.includes(name) ? prev.filter((x) => x !== name) : [...prev, name]));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (dealerName.trim().length < 3) return setError('Enter your dealer name (showroom name).');
    if (!contactPerson.trim()) return setError('Enter the contact person.');
    if (!/^\S+@\S+\.\S+$/.test(email)) return setError('Enter a valid email.');
    if (!/^[6-9]\d{9}$/.test(phone.replace(/\s/g, ''))) return setError('Enter a valid 10-digit mobile number.');
    if (!city.trim()) return setError('Enter the city.');
    if (!state) return setError('Select the state.');
    if (!brandSel.length) return setError('Select at least one brand you represent.');
    setBusy(true);
    try {
      await createDealerApplication({
        dealer_name: dealerName.trim(),
        business_name: businessName.trim() || null,
        contact_person: contactPerson.trim(),
        email: email.trim(),
        phone: phone.replace(/\s/g, ''),
        address: address.trim() || null,
        city: city.trim(),
        state,
        pincode: pincode.trim() || null,
        gst_number: gst.trim() || null,
        brands: brandSel,
        website: website.trim() || null,
      });
      // upload + link docs
      if (docs.length) {
        const sb = (await import('../../lib/supabase')).requireSupabase();
        const { data: dRow } = await sb.from('dealer_profiles').select('id').eq('user_id', profile!.id).maybeSingle();
        if (dRow?.id) {
          for (const d of docs) {
            if (d.path) {
              await sb.from('dealer_documents').insert({
                dealer_id: dRow.id,
                doc_type: d.doc_type,
                label: d.label,
                bucket: 'private-documents',
                storage_path: d.path,
                mime_type: d.mime,
                file_size: d.size,
              });
            }
          }
        }
      }
      toast('Dealer application submitted! Our team will verify your documents.', 'success');
      navigate('/dealer/register?submitted=1', { replace: true });
      // refresh existing state
      setTimeout(async () => {
        const d = await getMyDealer();
        setExisting(d);
      }, 500);
    } catch (err: any) {
      setError(err.message || 'Could not submit the application.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="container-x max-w-3xl py-8">
      <nav className="mb-3 text-xs text-ink-400">
        <Link to="/" className="hover:text-primary-600">Home</Link>
        <span className="mx-1.5">/</span>
        <span className="font-semibold text-ink-700">Dealer Registration</span>
      </nav>
      <h1 className="text-3xl font-black tracking-tight text-ink-900">Become a Verified Dealer</h1>
      <p className="mt-1 mb-6 max-w-2xl text-sm text-ink-500">
        Verified dealers get the <strong>Verified Dealer</strong> badge, can publish offers on bike pages, and reach thousands of active buyers. Your application and proof documents are reviewed by our admin team.
      </p>

      {error && <p className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</p>}

      <form onSubmit={submit} className="space-y-6">
        <Card className="p-5">
          <h2 className="mb-4 text-lg font-black text-ink-900">Business details</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Dealer / showroom name" required>
              <Input value={dealerName} onChange={(e) => setDealerName(e.target.value)} placeholder="e.g. Sri Balaji Motors" />
            </Field>
            <Field label="Registered business name (if different)">
              <Input value={businessName} onChange={(e) => setBusinessName(e.target.value)} placeholder="e.g. S.B. Motors Pvt Ltd" />
            </Field>
            <Field label="Contact person" required>
              <Input value={contactPerson} onChange={(e) => setContactPerson(e.target.value)} placeholder="Name of the person in charge" />
            </Field>
            <Field label="Business email" required>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="sales@dealershowroom.in" />
            </Field>
            <Field label="Business phone" required>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="10-digit number" inputMode="tel" />
            </Field>
            <Field label="GST number (if applicable)">
              <Input value={gst} onChange={(e) => setGst(e.target.value)} placeholder="15-digit GSTIN" />
            </Field>
            <Field label="Showroom address" required>
              <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Shop no, street, landmark" />
            </Field>
            <Field label="City" required>
              <Input value={city} onChange={(e) => setCity(e.target.value)} placeholder="e.g. Coimbatore" />
            </Field>
            <Field label="State" required>
              <Select value={state} onChange={(e) => setState(e.target.value)}>
                <option value="">Select…</option>
                {STATES.map((s) => <option key={s}>{s}</option>)}
              </Select>
            </Field>
            <Field label="Pincode">
              <Input value={pincode} onChange={(e) => setPincode(e.target.value)} placeholder="6-digit" inputMode="numeric" />
            </Field>
            <Field label="Website (optional)">
              <Input value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://…" />
            </Field>
          </div>
        </Card>

        <Card className="p-5">
          <h2 className="mb-1 text-lg font-black text-ink-900">Brands you represent</h2>
          <p className="mb-4 text-xs text-ink-400">Select all brands whose bikes you sell — minimum one.</p>
          <div className="flex flex-wrap gap-2">
            {brands.map((b) => (
              <button
                key={b.id}
                type="button"
                onClick={() => toggleBrand(b.name)}
                className={`rounded-full px-3.5 py-1.5 text-sm font-bold transition ${brandSel.includes(b.name) ? 'bg-ink-900 text-white' : 'border border-ink-300 bg-white text-ink-700'}`}
              >
                {b.name}
              </button>
            ))}
          </div>
          {!brands.length && <p className="text-sm text-ink-400">Brands will appear here once added in the admin panel.</p>}
        </Card>

        <Card className="p-5">
          <h2 className="mb-1 text-lg font-black text-ink-900">Business details (optional)</h2>
          <Field label="Tell us about your dealership">
            <Textarea value={details} onChange={(e) => setDetails(e.target.value)} placeholder="Years in business, floor space, service facility, teams…" />
          </Field>
        </Card>

        <Card className="p-5">
          <h2 className="mb-1 text-lg font-black text-ink-900">Proof documents</h2>
          <p className="mb-4 text-xs text-ink-400">
            Business proof (shop rent agreement / licence), GST certificate and identity proof speed up verification. Stored in <strong>private</strong> storage — visible only to you and the admin team.
          </p>
          <DocUploader docs={docs} onChange={setDocs} pathPrefix={`dealer/${profile?.id}`} />
        </Card>

        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-ink-400">
            By applying you agree to the <Link to="/dealer-terms" className="font-bold text-primary-600 hover:underline">Dealer Terms</Link>.
          </p>
          <Button type="submit" loading={busy} size="lg">Submit application</Button>
        </div>
      </form>
    </div>
  );
}
