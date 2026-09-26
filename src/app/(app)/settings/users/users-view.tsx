"use client";

import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/common/page-header";
import { TableSkeleton } from "@/components/common/table-skeleton";
import { useSession } from "@/components/layout/session-context";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useApiMutation } from "@/hooks/use-api-mutation";
import { api } from "@/lib/api-client";
import { ROLE_LABELS, ROLES, type Role } from "@/lib/constants";
import { formatRelative, initials } from "@/lib/format";
import type { UserDTO } from "@/lib/types";

export function UsersView() {
  const { user: me } = useSession();
  const { data, isLoading } = useQuery({ queryKey: ["users"], queryFn: () => api<UserDTO[]>("/api/users") });
  const update = useApiMutation<{ id: string; role?: Role; isActive?: boolean }>({
    mutationFn: ({ id, ...body }) => api(`/api/users/${id}`, { method: "PATCH", body }),
    invalidate: [["users"]],
    success: "User updated",
  });

  return (
    <>
      <PageHeader
        title="Users"
        description="Inventory managers plan receipts and deliveries; warehouse staff pick, transfer and count."
      />
      <Card className="gap-0 py-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Login ID</TableHead>
              <TableHead className="w-52">Role</TableHead>
              <TableHead>Last sign-in</TableHead>
              <TableHead className="w-24 text-right">Active</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableSkeleton columns={5} />
            ) : (
              data?.map((user) => {
                const isMe = user.id === me.id;
                return (
                  <TableRow key={user.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="size-8">
                          <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">{initials(user.name)}</AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="truncate font-medium">
                            {user.name} {isMe && <span className="text-xs text-muted-foreground">(you)</span>}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">{user.email}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-sm">{user.loginId}</TableCell>
                    <TableCell>
                      <Select
                        value={user.role}
                        disabled={isMe || update.isPending}
                        onValueChange={(role) => update.mutate({ id: user.id, role: role as Role })}
                      >
                        <SelectTrigger size="sm" className="w-44" aria-label={`Role of ${user.name}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {ROLES.map((role) => (
                            <SelectItem key={role} value={role}>
                              {ROLE_LABELS[role]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {user.lastLoginAt ? formatRelative(user.lastLoginAt) : "Never"}
                    </TableCell>
                    <TableCell className="text-right">
                      <Switch
                        checked={user.isActive}
                        disabled={isMe || update.isPending}
                        onCheckedChange={(isActive) => update.mutate({ id: user.id, isActive })}
                        aria-label={`${user.isActive ? "Deactivate" : "Activate"} ${user.name}`}
                      />
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </Card>
    </>
  );
}
