import type { MoveDirection } from "@/lib/types";
import { operationFilters } from "@/server/filters";
import { pageParams, route, searchParam } from "@/server/http";
import { listMoves } from "@/server/services/moves";

const DIRECTIONS: MoveDirection[] = ["in", "out", "internal"];

export const GET = route({}, async ({ req }) => {
  const direction = searchParam(req, "direction") as MoveDirection | undefined;
  return listMoves(
    {
      ...operationFilters(req),
      direction: direction && DIRECTIONS.includes(direction) ? direction : undefined,
      doneOnly: searchParam(req, "done") === "1",
    },
    pageParams(req, 25),
  );
});
