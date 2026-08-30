import { db } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { ProfileForm } from '@/components/ProfileForm';
import { LogoutButton } from '@/components/LogoutButton';
import { buildMetadata } from '@/lib/seo';

export const dynamic = 'force-dynamic';
export const metadata = buildMetadata({ title: 'Profile', description: 'Your profile and notification preferences.', path: '/account/profile', robots: 'noindex,nofollow' });

export default async function ProfilePage() {
  const user = await requireUser();
  const row = await db.get<any>('SELECT full_name, email, phone, city, notify_email, notify_sms FROM users WHERE id = ?', [user.id]);
  return (
    <div className="space-y-4">
      <h2 className="text-[15px] font-semibold">Profile & preferences</h2>
      <div className="card p-5"><ProfileForm initial={row} /></div>
      <div className="card p-5">
        <h3 className="text-[14px] font-semibold">Session</h3>
        <p className="mt-1 text-[12.5px] text-ink-mute">Signed in as {user.email}. Signing out ends this session on this device.</p>
        <div className="mt-3 w-32"><LogoutButton className="btn-outline btn-sm w-full" /></div>
      </div>
    </div>
  );
}
