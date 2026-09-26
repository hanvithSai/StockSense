"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Download, ScrollText } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { actionMeta, ActionIcon } from "@/components/activity/action-icon";
import { EmptyState } from "@/components/common/empty-state";
import { FilterSelect } from "@/components/common/filter-select";
import { PageHeader } from "@/components/common/page-header";
import { PaginationBar } from "@/components/common/pagination-bar";
import { SearchInput } from "@/components/common/search-input";
import { TableSkeleton } from "@/components/common/table-skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useUserOptions } from "@/hooks/use-reference-data";
import { api, errorMessage, qs } from "@/lib/api-client";
import { AUDIT_ENTITIES, AUDIT_ENTITY_LABELS, LIVE_REFRESH_MS } from "@/lib/constants";
import { downloadCsv } from "@/lib/csv";
import { formatDateTime, formatRelative, todayISO } from "@/lib/format";
import type { AuditLogDTO, Paginated } from "@/lib/types";

export function AuditLogView() {
  const [search, setSearch] = useState("");
  const [entityType, setEntityType] = useState("");
  const [user, setUser] = useState("");
  const [page, setPage] = useState(1);
  const [exporting, setExporting] = useState(false);
  const q = useDebouncedValue(search.trim(), 250);
  const { data: users = [] } = useUserOptions();

  const params = { q, entityType, user, page, limit: 30 };
  const { data, isLoading } = useQuery({
    queryKey: ["audit", params],
    queryFn: () => api<Paginated<AuditLogDTO>>(`/api/audit${qs(params)}`),
    placeholderData: keepPreviousData,
    refetchInterval: LIVE_REFRESH_MS,
  });

  const reset = (setter: (value: string) => void) => (value: string) => {
    setter(value);
    setPage(1);
  };

  async function exportCsv() {
    setExporting(true);
    try {
      const rows: AuditLogDTO[] = [];
      for (let next = 1; next <= 25; next += 1) {
        const batch = await api<Paginated<AuditLogDTO>>(`/api/audit${qs({ ...params, page: next, limit: 200 })}`);
        rows.push(...batch.items);
        if (rows.length >= batch.total || batch.items.length === 0) break;
      }
      downloadCsv(
        `audit-log-${todayISO()}.csv`,
        ["Time", "User", "Record type", "Record", "Action", "Details"],
        rows.map((row) => [
          formatDateTime(row.createdAt),
          row.userName,
          AUDIT_ENTITY_LABELS[row.entityType],
          row.entityLabel,
          actionMeta(row.action).label,
          row.message,
        ]),
      );
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setExporting(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Audit Log"
        description="Tamper-evident history of every change: who did what, on which record, and when."
        actions={
          <Button variant="outline" onClick={exportCsv} disabled={exporting || !data?.total}>
            {exporting ? <Spinner /> : <Download />} Export CSV
          </Button>
        }
      />
      <Card className="gap-0 py-0">
        <div className="flex flex-wrap items-center gap-2 border-b p-3">
          <SearchInput value={search} onChange={reset(setSearch)} placeholder="Search details, record or user…" />
          <FilterSelect
            value={entityType}
            onChange={reset(setEntityType)}
            allLabel="All records"
            options={AUDIT_ENTITIES.map((value) => ({ value, label: AUDIT_ENTITY_LABELS[value] }))}
          />
          <FilterSelect
            value={user}
            onChange={reset(setUser)}
            allLabel="All users"
            options={users.map((item) => ({ value: item.id, label: item.name }))}
          />
          <span className="ml-auto text-sm text-muted-foreground tabular">{data?.total ?? 0} events</span>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-48">When</TableHead>
              <TableHead>User</TableHead>
              <TableHead>Record</TableHead>
              <TableHead>Details</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableSkeleton columns={4} rows={8} />
            ) : !data?.items.length ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={4}>
                  <EmptyState icon={ScrollText} title="No events found" description="Try clearing the filters." />
                </TableCell>
              </TableRow>
            ) : (
              data.items.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell className="whitespace-nowrap text-sm">
                    <p>{formatRelative(entry.createdAt)}</p>
                    <p className="text-xs text-muted-foreground">{formatDateTime(entry.createdAt)}</p>
                  </TableCell>
                  <TableCell className="text-sm font-medium">{entry.userName}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="mb-1 font-normal">
                      {AUDIT_ENTITY_LABELS[entry.entityType]}
                    </Badge>
                    {entry.link ? (
                      <Link href={entry.link} className="block truncate font-mono text-sm font-medium hover:underline">
                        {entry.entityLabel}
                      </Link>
                    ) : (
                      <p className="truncate font-mono text-sm text-muted-foreground">{entry.entityLabel}</p>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-start gap-2.5">
                      <ActionIcon action={entry.action} className="ring-0" />
                      <p className="pt-1 text-sm">{entry.message}</p>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        {data && <PaginationBar page={data.page} limit={data.limit} total={data.total} onPageChange={setPage} />}
      </Card>
    </>
  );
}
