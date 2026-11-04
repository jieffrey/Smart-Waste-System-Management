import { formatDate } from "@/lib/format";
import type { AdminUser } from "@/types/api";
import { UserActiveToggle } from "./UserActiveToggle";

function ActiveBadge({ isActive }: { isActive: boolean }) {
  return (
    <span
      className={`inline-block rounded-full px-2 py-0.5 text-micro font-medium whitespace-nowrap ${
        isActive ? "bg-green-100 text-green-800" : "bg-zinc-200 text-zinc-700"
      }`}
    >
      {isActive ? "Active" : "Deactivated"}
    </span>
  );
}

// `currentAdminId` hides the activate/deactivate button on the signed-in admin's own row.
export function UsersTable({ users, currentAdminId }: { users: AdminUser[]; currentAdminId: string | null }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
      <table className="w-full min-w-[800px] text-small">
        <thead className="border-b border-zinc-200 text-left text-zinc-500">
          <tr>
            <th className="px-3 py-2 font-normal">Name</th>
            <th className="px-3 py-2 font-normal">Email</th>
            <th className="px-3 py-2 font-normal">Role</th>
            <th className="px-3 py-2 font-normal">Status</th>
            <th className="px-3 py-2 text-right font-normal">Reports</th>
            <th className="px-3 py-2 font-normal">Joined (WIB)</th>
            <th className="px-3 py-2 font-normal">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100">
          {users.map((user) => (
            <tr key={user.id}>
              <td className="px-3 py-2 font-medium">{user.full_name}</td>
              <td className="px-3 py-2 text-zinc-600">{user.email}</td>
              <td className="px-3 py-2">{user.role === "admin" ? "Admin" : "User"}</td>
              <td className="px-3 py-2">
                <ActiveBadge isActive={user.is_active} />
              </td>
              <td className="px-3 py-2 text-right">{user.report_count}</td>
              <td className="px-3 py-2 whitespace-nowrap">{formatDate(user.created_at)}</td>
              <td className="px-3 py-2">
                {user.id === currentAdminId ? (
                  <span className="text-micro text-zinc-400">You</span>
                ) : (
                  <UserActiveToggle userId={user.id} userName={user.full_name} isActive={user.is_active} />
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
