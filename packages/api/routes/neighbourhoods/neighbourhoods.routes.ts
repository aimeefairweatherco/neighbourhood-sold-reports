import { createRoute, z } from "@hono/zod-openapi";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { jsonContent } from "stoker/openapi/helpers";
import { createErrorSchema, IdParamsSchema } from "stoker/openapi/schemas";
import { neighbourhoodSelectSchema, pdfSelectSchema } from "@scope/db/schema";
import { notFoundSchema } from "@/lib/constants.ts";

const tags = ["Neighbourhoods"];

export const list = createRoute({
   path: "/neighbourhoods",
   method: "get",
   tags,
   responses: {
      [HttpStatusCodes.OK]: jsonContent(
         z.array(neighbourhoodSelectSchema),
         "The list of neighbourhoods",
      ),
   },
});

export const getOne = createRoute({
   path: "/neighbourhoods/{id}",
   method: "get",
   request: {
      params: IdParamsSchema,
   },
   tags,
   responses: {
      [HttpStatusCodes.OK]: jsonContent(
         z.array(pdfSelectSchema),
         "The requested pdfs",
      ),
      [HttpStatusCodes.NOT_FOUND]: jsonContent(
         notFoundSchema,
         "PDFs not found",
      ),
      [HttpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(
         createErrorSchema(IdParamsSchema),
         "Invalid id error",
      ),
   },
});

export type ListRoute = typeof list;
export type GetOneRoute = typeof getOne;
