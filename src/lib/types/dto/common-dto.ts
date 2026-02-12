import { z } from "zod";

export const paginationSchema = z.object({
  limit: z.coerce.number().int().positive().max(100).optional().default(10),
  offset: z.coerce.number().int().min(0).optional().default(0),
});

export type PaginationDto = z.infer<typeof paginationSchema>;

export const idParamSchema = z.object({ id: z.string().uuid() });

export type IdParamDto = z.infer<typeof idParamSchema>;
