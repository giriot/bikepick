import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createReport } from '../lib/api';
import { REPORT_REASONS } from '../lib/format';
import { useApp } from '../context/AppContext';
import { Button, Field, Input, Modal, Select, Textarea } from './ui';

export default function ReportModal({
  open,
  onClose,
  itemType,
  itemId,
  itemLabel,
}: {
  open: boolean;
  onClose: () => void;
  itemType: 'used_bike' | 'dealer_offer' | 'dealer' | 'bike' | 'review' | 'other';
  itemId: string;
  itemLabel: string;
}) {
  const [reason, setReason] = useState<ReportModalReason>('fake_listing');
  const [details, setDetails] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const { isAuthed, toast } = useApp();
  const navigate = useNavigate();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!isAuthed) {
      toast('Please log in to report a listing.', 'error');
      navigate(`/login?redirect=${encodeURIComponent(location.pathname)}`);
      return;
    }
    setBusy(true);
    try {
      await createReport({ item_type: itemType, item_id: itemId, item_label: itemLabel, reason, details: details.trim() || null });
      setDone(true);
    } catch (err: any) {
      setError(err.message || 'Could not submit the report.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={() => { setDone(false); onClose(); }} title="Report this listing">
      {done ? (
        <div className="py-4 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
            <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
          </div>
          <h4 className="text-lg font-bold text-ink-900">Report submitted</h4>
          <p className="mt-1 text-sm text-ink-500">Our trust &amp; safety team will review this shortly. Thank you for keeping CompareBike safe.</p>
          <Button className="mt-5" onClick={() => { setDone(false); onClose(); }}>Done</Button>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <p className="text-sm text-ink-500">Reporting: <strong className="text-ink-800">{itemLabel}</strong></p>
          <Field label="Reason" required>
            <Select value={reason} onChange={(e) => setReason(e.target.value as ReportModalReason)}>
              {REPORT_REASONS.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </Select>
          </Field>
          <Field label="Details (optional)">
            <Textarea value={details} onChange={(e) => setDetails(e.target.value)} placeholder="Tell us what's wrong with this listing…" />
          </Field>
          {error && <p className="text-sm font-semibold text-red-600">{error}</p>}
          <div className="flex gap-2">
            <Button type="submit" variant="danger" loading={busy} className="flex-1">Submit report</Button>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          </div>
        </form>
      )}
    </Modal>
  );
}

type ReportModalReason = 'fake_listing' | 'fraud' | 'wrong_information' | 'duplicate' | 'wrong_price' | 'sold' | 'other';
