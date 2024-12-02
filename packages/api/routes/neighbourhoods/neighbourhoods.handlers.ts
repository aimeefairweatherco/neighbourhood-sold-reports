import * as HttpStatusPhrases from "stoker/http-status-phrases";
import * as HttpStatusCodes from "stoker/http-status-codes";
import type { AppRouteHandler } from "@/lib/types.ts";
import { db } from "@scope/db";

import type { GetOneRoute, ListRoute } from "./neighbourhoods.routes.ts";

export const list: AppRouteHandler<ListRoute> = async (c) => {
   const neighbourhoods = await db.execute("SELECT * FROM neighbourhoods");
   return c.json(neighbourhoods.rows);
};

export const getOne: AppRouteHandler<GetOneRoute> = async (c) => {
   const { id } = c.req.valid("param");
   const pdfs = await db.execute({
      sql: "SELECT * FROM pdfs WHERE neighbourhood_id = ?",
      args: [id],
   });

   if (pdfs.rows.length === 0) {
      return c.json(
         {
            message: HttpStatusPhrases.NOT_FOUND,
         },
         HttpStatusCodes.NOT_FOUND,
      );
   }

   return c.json(pdfs.rows, HttpStatusCodes.OK);
};
