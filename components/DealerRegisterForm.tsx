'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

const MAX_VISITING_CARD_BYTES = 4 * 1024 * 1024;

async function responseJson(response: Response): Promise<any> {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    return { ok: false, error: `Request failed (${response.status || 'no response'})` };
  }
}

export function DealerRegisterForm({ brands, defaults }: {
  brands: { id: string; name: string }[];
  defaults: { name: string; phone: string; email: string; city: string };
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState<string[]>([]);
  const [businessEmail, setBusinessEmail] = useState(defaults.email);
  const [emailOtpSent, setEmailOtpSent] = useState(false);
  const [emailOtpCode, setEmailOtpCode] = useState('');
  const [emailVerified, setEmailVerified] = useState(false);
  const [emailOtpBusy, setEmailOtpBusy] = useState(false);
  const [emailOtpNotice, setEmailOtpNotice] = useState<string | null>(null);
  const [visitingCardName, setVisitingCardName] = useState('');

  const fieldClass = (name: string) => fields[name]
    ? 'field !border-rose-400 !bg-rose-50/40 focus:!border-rose-500'
    : 'field';

  const Label = ({ htmlFor, children, optional = false }: { htmlFor: string; children: React.ReactNode; optional?: boolean }) => (
    <label className="mb-1.5 block text-[13px] font-medium text-ink" htmlFor={htmlFor}>
      {children}{optional ? <span className="ml-1 font-normal text-ink-mute">(optional)</span> : <span className="ml-1 text-rose-600" aria-hidden="true">*</span>}
    </label>
  );

  const Err = ({ name }: { name: string }) => fields[name]
    ? <p className="mt-1 text-[12px] leading-4 text-rose-700" role="alert">{fields[name]}</p>
    : null;

  function changeBusinessEmail(value: string) {
    setBusinessEmail(value);
    setEmailOtpSent(false);
    setEmailOtpCode('');
    setEmailVerified(false);
    setEmailOtpNotice(null);
    setFields((previous) => {
      const next = { ...previous };
      delete next.email;
      return next;
    });
  }

  async function sendBusinessEmailOtp() {
    const email = businessEmail.trim().toLowerCase();
    if (!email || !email.includes('@')) {
      setFields((previous) => ({ ...previous, email: 'Enter a valid business email first' }));
      return;
    }
    setEmailOtpBusy(true); setError(null); setEmailOtpNotice(null);
    try {
      const res = await fetch('/api/dealer/send-email-otp', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'same-origin',
        cache: 'no-store',
        body: JSON.stringify({ email }),
      });
      const json = await responseJson(res);
      if (!res.ok || !json.ok) {
        setError(json.error || 'Could not send the email code');
        return;
      }
      setBusinessEmail(email);
      setEmailOtpSent(true);
      setEmailOtpCode('');
      setEmailOtpNotice(json.message || 'A 6-digit code was sent to this email.');
    } catch {
      setError('Could not reach the email service. Check your connection and try again.');
    } finally {
      setEmailOtpBusy(false);
    }
  }

  async function verifyBusinessEmailOtp() {
    if (emailOtpCode.length !== 6) return;
    setEmailOtpBusy(true); setError(null); setEmailOtpNotice(null);
    try {
      const res = await fetch('/api/dealer/verify-email', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'same-origin',
        cache: 'no-store',
        body: JSON.stringify({ email: businessEmail.trim().toLowerCase(), code: emailOtpCode }),
      });
      const json = await responseJson(res);
      if (!res.ok || !json.ok) {
        setError(json.error || 'Could not verify the email code');
        return;
      }
      setEmailVerified(true);
      setEmailOtpNotice(json.message || 'Business email verified. You can submit the application.');
    } catch {
      setError('Could not reach the verification service. Check your connection and try again.');
    } finally {
      setEmailOtpBusy(false);
    }
  }

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setFields({});

    if (!emailVerified) {
      setError('Verify the business email with the OTP before submitting.');
      setFields({ email: 'Verify this email address first.' });
      setBusy(false);
      return;
    }

    const fd = new FormData(e.currentTarget);
    const visitingCard = fd.get('visiting_card');
    if (!(visitingCard instanceof File) || visitingCard.size === 0) {
      setError('Please upload the visiting card before submitting.');
      setFields({ visiting_card: 'Visiting card is required for dealership confirmation.' });
      setBusy(false);
      return;
    }
    if (visitingCard.size > MAX_VISITING_CARD_BYTES) {
      setError('The visiting card is too large. Please choose a file up to 4 MB.');
      setFields({ visiting_card: 'Maximum file size is 4 MB.' });
      setBusy(false);
      return;
    }

    try {
      const upload = new FormData();
      upload.append('file', visitingCard);
      upload.append('purpose', 'dealer_document');
      const uploadRes = await fetch('/api/uploads', {
        method: 'POST', body: upload, credentials: 'same-origin', cache: 'no-store',
      });
      const uploadJson = await responseJson(uploadRes);
      if (!uploadRes.ok || !uploadJson.ok || !uploadJson.data?.key) {
        setError(uploadJson.error || 'Could not upload the visiting card.');
        setFields({ visiting_card: uploadJson.error || 'Upload the visiting card again.' });
        setBusy(false);
        return;
      }

      const payload: Record<string, FormDataEntryValue> = Object.fromEntries(fd.entries());
      delete payload.visiting_card;
      payload.visiting_card_key = uploadJson.data.key;

      const res = await fetch('/api/dealer/register', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ...payload, brands: selected }),
        credentials: 'same-origin',
        cache: 'no-store',
      });
      const json = await responseJson(res);
      if (!res.ok || !json.ok) {
        const nextFields: Record<string, string> = { ...(json.fields || {}) };
        if (nextFields.visiting_card_key) nextFields.visiting_card = nextFields.visiting_card_key;
        setError(json.error || 'Could not submit');
        setFields(nextFields);
        setBusy(false);
        return;
      }

      router.push('/dealer');
      router.refresh();
    } catch (err) {
      const message = err instanceof TypeError && /fetch/i.test(err.message)
        ? 'Could not reach the upload service. Check your connection, refresh the page, and try again.'
        : err instanceof Error ? err.message : 'Could not submit the dealership application.';
      setError(message);
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      {error && <div className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-[13px] text-rose-800" role="alert">{error}</div>}
      <p className="text-[12px] text-ink-mute"><span className="text-rose-600">*</span> Required fields</p>

      <fieldset className="space-y-3.5">
        <legend className="text-[13px] font-semibold uppercase tracking-wide text-ink-mute">Business</legend>
        <div className="grid gap-3.5 sm:grid-cols-2">
          <div><Label htmlFor="business_name">Dealership name</Label>
            <input id="business_name" name="business_name" required className={fieldClass('business_name')} placeholder="Sri Balaji Motors" /><Err name="business_name" /></div>
          <div><Label htmlFor="dealer_name">Contact person</Label>
            <input id="dealer_name" name="dealer_name" required defaultValue={defaults.name} className={fieldClass('dealer_name')} /><Err name="dealer_name" /></div>
          <div><Label htmlFor="phone">Phone</Label>
            <input id="phone" name="phone" required inputMode="numeric" defaultValue={defaults.phone} className={fieldClass('phone')} placeholder="10-digit mobile" /><Err name="phone" /></div>
          <div><Label htmlFor="whatsapp" optional>WhatsApp</Label>
            <input id="whatsapp" name="whatsapp" inputMode="numeric" className={fieldClass('whatsapp')} /><Err name="whatsapp" /></div>
          <div>
            <Label htmlFor="email">Business email</Label>
            <div className="flex gap-2">
              <input id="email" name="email" type="email" required value={businessEmail}
                onChange={(event) => changeBusinessEmail(event.target.value)} className={`${fieldClass('email')} min-w-0 flex-1`} />
              <button type="button" onClick={sendBusinessEmailOtp} disabled={emailOtpBusy || emailVerified || !businessEmail.trim()}
                className="btn-outline btn-sm shrink-0">{emailOtpBusy ? 'Sending…' : emailVerified ? 'Verified' : emailOtpSent ? 'Resend OTP' : 'Get OTP'}</button>
            </div>
            <p className="mt-1 text-[11.5px] text-ink-mute">Enter the email, click Get OTP, then verify the 6-digit code before submitting.</p>
            {emailVerified && <p className="mt-1 text-[12px] font-semibold text-emerald-700">✓ Business email verified</p>}
            {emailOtpNotice && !emailVerified && <p className="mt-1 text-[12px] text-brand-700" role="status">{emailOtpNotice}</p>}
            <Err name="email" />
            {emailOtpSent && !emailVerified && (
              <div className="mt-2 flex gap-2">
                <input aria-label="Dealer email OTP" value={emailOtpCode}
                  onChange={(event) => setEmailOtpCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                  inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="6-digit OTP"
                  className="field min-w-0 flex-1" />
                <button type="button" onClick={verifyBusinessEmailOtp} disabled={emailOtpBusy || emailOtpCode.length !== 6}
                  className="btn-primary btn-sm shrink-0">{emailOtpBusy ? 'Checking…' : 'Verify OTP'}</button>
              </div>
            )}
          </div>
          <div><Label htmlFor="gstin" optional>GSTIN</Label>
            <input id="gstin" name="gstin" className={fieldClass('gstin')} placeholder="22AAAAA0000A1Z5" /><Err name="gstin" />
            <p className="mt-1 text-[11.5px] text-ink-mute">Speeds up verification considerably.</p></div>
        </div>
      </fieldset>

      <fieldset className="space-y-3.5">
        <legend className="text-[13px] font-semibold uppercase tracking-wide text-ink-mute">Showroom address</legend>
        <div><Label htmlFor="address">Address</Label>
          <textarea id="address" name="address" required rows={2} className={fieldClass('address')} /><Err name="address" /></div>
        <div className="grid gap-3.5 sm:grid-cols-3">
          <div><Label htmlFor="city">City</Label>
            <input id="city" name="city" required defaultValue={defaults.city} className={fieldClass('city')} /><Err name="city" /></div>
          <div><Label htmlFor="state">State</Label>
            <input id="state" name="state" required className={fieldClass('state')} /><Err name="state" /></div>
          <div><Label htmlFor="pincode">Pincode</Label>
            <input id="pincode" name="pincode" required inputMode="numeric" className={fieldClass('pincode')} /><Err name="pincode" /></div>
        </div>
      </fieldset>

      <fieldset>
        <legend className="text-[13px] font-semibold uppercase tracking-wide text-ink-mute">Brands you sell</legend>
        <div className="mt-2.5 flex flex-wrap gap-2">
          {brands.map((b) => {
            const on = selected.includes(b.name);
            return (
              <button key={b.id} type="button" onClick={() => setSelected(on ? selected.filter((x) => x !== b.name) : [...selected, b.name])}
                aria-pressed={on} className={`chip ${on ? 'chip-active' : ''}`}>{b.name}</button>
            );
          })}
        </div>
      </fieldset>

      <fieldset className="rounded-xl border border-brand-200 bg-brand-50/40 p-4">
        <legend className="px-1 text-[13px] font-semibold uppercase tracking-wide text-ink-mute">Dealership confirmation</legend>
        <Label htmlFor="visiting_card">Visiting card or dealership proof</Label>
        <input id="visiting_card" name="visiting_card" type="file" required accept="image/jpeg,image/png,image/webp,application/pdf"
          aria-describedby="visiting_card_help" className={`${fieldClass('visiting_card')} py-2`}
          onChange={(event) => setVisitingCardName(event.target.files?.[0]?.name || '')} />
        {visitingCardName && <p className="mt-1 text-[12px] text-emerald-700">Selected: {visitingCardName}</p>}
        <p id="visiting_card_help" className="mt-1 text-[11.5px] leading-4 text-ink-mute">Required for confirmation. PDF or image, maximum 4 MB. Stored privately for verification.</p>
        <Err name="visiting_card" />

        <label className="mt-4 flex items-start gap-2 text-[12.5px] leading-5 text-ink-soft">
          <input type="checkbox" name="confirm_details" value="on" required className="mt-1 h-4 w-4 shrink-0 accent-brand-600" />
          <span>I confirm that the dealership information is accurate and that the uploaded visiting card belongs to this business.<span className="ml-1 text-rose-600" aria-hidden="true">*</span></span>
        </label>
        <Err name="confirm_details" />
      </fieldset>

      <div><Label htmlFor="about" optional>About your dealership</Label>
        <textarea id="about" name="about" rows={3} className={fieldClass('about')} placeholder="Years in business, services offered, workshop facilities…" /></div>

      <div className="rounded-xl bg-surface p-4 text-[12.5px] leading-5 text-ink-mute">
        Submitting starts a verification review. We check your business details before your dealership appears publicly or
        can publish offers. By continuing you accept the <Link href="/legal/terms" className="underline">Terms of Use</Link>.
      </div>

      <button className="btn-primary" disabled={busy}>{busy ? 'Uploading & submitting…' : 'Submit application'}</button>
    </form>
  );
}
