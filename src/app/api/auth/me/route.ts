import { route } from "@/server/http";

export const GET = route({}, async ({ user }) => user);
