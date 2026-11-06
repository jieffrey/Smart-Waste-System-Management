import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDate } from "@/lib/format";
import type { AdminUser } from "@/types/api";
import { UserActiveToggle } from "./UserActiveToggle";

// Active state without color: a filled square for active, an empty one for deactivated.
function ActiveMarker({ isActive }: { isActive: boolean }) {
  return (
    <span className="inline-flex items-center gap-2 text-small whitespace-nowrap text-ink">
      <span className={`size-3 border-[1.5px] border-ink ${isActive ? "bg-ink" : ""}`} aria-hidden="true" />
      {isActive ? "Active" : <span className="text-gray-700">Deactivated</span>}
    </span>
  );
}

// `currentAdminId` hides the activate/deactivate button on the signed-in admin's own row.
export function UsersTable({ users, currentAdminId }: { users: AdminUser[]; currentAdminId: string | null }) {
  return (
    <Table className="md:min-w-[820px]">
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead>Name</TableHead>
          <TableHead className="hidden md:table-cell">Email</TableHead>
          <TableHead className="hidden md:table-cell">Role</TableHead>
          <TableHead>Status</TableHead>
          <TableHead numeric className="hidden md:table-cell">Reports</TableHead>
          <TableHead numeric className="hidden md:table-cell">Joined (WIB)</TableHead>
          <TableHead>
            <span className="sr-only">Actions</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {users.map((user) => (
          <TableRow key={user.id}>
            <TableCell className="font-semibold text-ink">{user.full_name}</TableCell>
            <TableCell className="hidden md:table-cell font-mono text-micro text-gray-700">{user.email}</TableCell>
            <TableCell className="hidden md:table-cell">
              {user.role === "admin" ? <span className="label-micro bg-ink px-1.5 py-0.5 text-snow">Admin</span> : "User"}
            </TableCell>
            <TableCell>
              <ActiveMarker isActive={user.is_active} />
            </TableCell>
            <TableCell numeric className="hidden md:table-cell">{user.report_count}</TableCell>
            <TableCell numeric className="hidden md:table-cell whitespace-nowrap text-gray-700">
              {formatDate(user.created_at)}
            </TableCell>
            <TableCell className="text-right">
              {user.id === currentAdminId ? (
                <span className="label-micro text-gray-600">You</span>
              ) : (
                <UserActiveToggle userId={user.id} userName={user.full_name} isActive={user.is_active} />
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
