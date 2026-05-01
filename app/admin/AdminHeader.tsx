import { UserButton } from '@clerk/nextjs';

type AdminHeaderProps = {
  email?: string | null;
  role?: string | null;
};

export default function AdminHeader({ email, role }: AdminHeaderProps) {
  return (
    <header className="flex items-center justify-between border-b border-gray-200 bg-white px-6 py-4">
      <div>
        <h1 className="text-lg font-semibold text-gray-900">
          Seers Platform Admin
        </h1>
      </div>

      <div className="flex items-center gap-3 text-right">
        <div>
          <p className="text-sm font-semibold text-gray-900">
            {email || 'Unknown user'}
          </p>
          <p className="text-xs text-gray-500">
            {email || 'No email'} · {role || 'user'}
          </p>
        </div>

        <UserButton />
      </div>
    </header>
  );
}