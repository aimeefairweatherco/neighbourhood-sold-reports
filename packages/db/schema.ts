import { createInsertSchema, createSelectSchema } from 'drizzle-zod';

import {
   integer,
   sqliteTable,
   text,
   uniqueIndex,
} from 'drizzle-orm/sqlite-core';
import { z } from 'zod';

/*
const regions = z.object({
    id: z.number(),
    name: z.string(),
    color: z.string(),
})

export const insertRegionSchema = createInsertSchema(regions);
export const selectRegionSchema = createSelectSchema(regions);

*/

export const neighbourhoods = sqliteTable('neighbourhoods', {
   id: integer().primaryKey({
      autoIncrement: true,
   }),
   nameCode: text('name_code').notNull(),
   namePretty: text('name_pretty').notNull(),
   polygonData: text('polygon_data').notNull(),
   //regionId: integer("region_id").references(() => regions.id).notNull(),
}); /*, (table) => {
   return {
      idxNameCode: uniqueIndex("idx_name_code").on(table.nameCode),
   };
});*/

type test = z.infer<typeof selectNeighbourhoodSchema>;
export const insertNeighbourhoodSchema = createInsertSchema(neighbourhoods);
export const selectNeighbourhoodSchema = createSelectSchema(neighbourhoods);

export const pdfs = sqliteTable('pdfs', {
   id: integer().primaryKey({
      autoIncrement: true,
   }),
   year: integer().notNull(),
   monthName: text('month_name').notNull(),
   monthNumber: integer('month_number').notNull(),
   neighbourhoodId: integer('neighbourhood_id').references(() =>
      neighbourhoods.id
   ).notNull(),
   url: text().notNull(),
}); /*, (table) => {
   return {
      idxYearMonthNeighbourhood: uniqueIndex("idx_year_month_neighbourhood").on(
         table.year,
         table.monthNumber,
         table.neighbourhoodId,
      ),
   };
});*/
