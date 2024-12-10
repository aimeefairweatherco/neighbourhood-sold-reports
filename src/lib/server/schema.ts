import { z } from 'zod';

export type RegionInsertSchema = z.infer<typeof regionInsertSchema>;
export const regionInsertSchema = z.object({
	id: z.number().positive().optional(),
	name: z.string(),
	color: z.string()
});

export type RegionSelectSchema = z.infer<typeof regionSelectSchema>;
export const regionSelectSchema = regionInsertSchema.extend({
	id: z.number().positive()
});

export type NeighourhoodInsertSchema = z.infer<typeof neighbourhoodInsertSchema>;
export const neighbourhoodInsertSchema = z.object({
	id: z.number().positive().optional(),
	name_code: z.string(),
	name_pretty: z.string(),
	polygon_data: z.string(),
	region_id: z.number().positive()
});

export type NeighbourhoodSelectSchema = z.infer<typeof neighbourhoodSelectSchema>;
export const neighbourhoodSelectSchema = neighbourhoodInsertSchema.extend({
	id: z.number().positive()
});

export type PdfInsertSchema = z.infer<typeof pdfInsertSchema>;
export const pdfInsertSchema = z.object({
	id: z.number().positive().optional(),
	year: z.number().positive(),
	month_name: z.string(),
	month_number: z.number().positive(),
	neighbourhood_id: z.number().positive(),
	url: z.string()
});

export type PdfSelectSchema = z.infer<typeof pdfInsertSchema>;
export const pdfSelectSchema = pdfInsertSchema.extend({
	id: z.number().positive()
});

export type PdfUpdateSchema = z.infer<typeof pdfUpdateSchema>;
export const pdfUpdateSchema = pdfInsertSchema.pick({ url: true });
