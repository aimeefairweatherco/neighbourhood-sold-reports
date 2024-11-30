import { google } from 'npm:googleapis';
import type { JWT } from 'npm:googleapis/auth';
import { resolve } from '@std/path';
import { walkSync } from '@std/fs';
import { createReadStream } from 'node:fs';
import { intro, log, outro, spinner } from 'npm:@clack/prompts';
import pc from 'npm:picocolors';
import { getAuth } from '../lib/auth.ts';
import z from 'npm:zod';
import { backup, db, type PdfInsert, RowId } from '../../db/db_old.ts';
import { Command } from 'commander';

type PDFMetadata = {
   name: string;
   path: string;
   id?: string;
};

type GoogleDriveFileMetadata = z.infer<typeof googleDriveFileMetadata>;
const googleDriveFileMetadata = z.object({
   id: z.string(),
   name: z.string(),
   size: z.coerce.number(),
   webViewLink: z.string(),
});

const googleDriveUploadResponse = z.object({
   data: googleDriveFileMetadata,
});

const drive = google.drive({
   version: 'v3',
});

const ROOT_FOLDER = '17v4G4S8u2megiehsQXFTyFxnFTDTPLpa';
const FIELDS = 'id, name, webViewLink, size';
const CWD = Deno.cwd();
const DB = await db();

export const upload = new Command('upload')
   .description('A CLI for uploading PDFs to Google Drive')
   .option('-C, --cwd <path>', 'path to working directory', CWD)
   .action((options, upload: Command) => {
      const cwd: string = options.cwd;
      const args: string[] = upload.args;

      runUpload(cwd, args);
   });

async function runUpload(cwd: string, args: string[]) {
   try {
      intro('Welcome to the Google Drive PDF Uploader');

      const s = spinner();

      s.message('Checking for PDFs to upload...');
      s.start();

      const pdfDir = resolve(cwd, 'data/pdfs');

      const pdfMeta = await getPDFMetadata(pdfDir);

      s.stop(
         `[${pc.bold(pc.green('DONE'))}] Found ${
            pc.cyan(
               pdfMeta.length,
            )
         } PDFs to upload`,
      );

      if (pdfMeta.length === 0) {
         outro('No PDFs found to upload');
         Deno.exit(0);
      }

      s.start('Authenticating with Google Drive...');

      const jwt = await getAuth();

      s.stop(`[${pc.bold(pc.green('DONE'))}] Authenticated with Google Drive`);

      s.message('Checking for existing PDFs on Google Drive...');
      s.start();

      const uploadList = await checkDriveForExisting(pdfMeta, jwt);

      const overwriteCount = uploadList.filter((file) => file.id).length;
      const uploadCount = uploadList.length - overwriteCount;

      s.stop(
         `[${pc.bold(pc.green('DONE'))}] Checking Google Drive: ${
            pc.cyan(
               overwriteCount,
            )
         } to overwrite, ${pc.cyan(uploadCount)} PDFs to upload`,
      );

      s.start();
      let count = 1;
      const files: GoogleDriveFileMetadata[] = [];
      for (const file of uploadList) {
         s.message(
            `[${count}/${uploadList.length}] ${
               file.id ? 'Overwriting' : 'Uploading'
            } ${pc.cyan(file.name)}`,
         );

         files.push(await uploadFile(file, jwt));
         count++;
      }

      s.stop(
         `[${pc.bold(pc.green('DONE'))}] Uploaded ${
            pc.cyan(
               uploadList.length,
            )
         } PDFs to Google Drive`,
      );

      s.message('Updating Database');
      s.start();
      const ops = await updateDB(files);
      s.stop(
         `[${pc.bold(pc.green('DONE'))}] Updated database ${
            pc.yellow(
               '[',
            )
         }inserted ${pc.cyan(ops.insertedRows.length)}, updated ${
            pc.cyan(
               ops.updatedRows.length,
            )
         } ${pc.yellow(']')}`,
      );

      outro('All operations complete');

      Deno.exit(0);
   } catch (error) {
      if (error instanceof Error) {
         log.error(error.message);
         console.error(error.stack);
      } else {
         log.error('An unknown error occurred');
      }
      DB.close();
      Deno.exit(0);
   }
}

async function uploadFile(file: PDFMetadata, jwt: JWT) {
   if (file.id) {
      await drive.files.delete({
         fileId: file.id,
         auth: jwt,
      });
   }

   const res = await drive.files.create({
      requestBody: {
         name: file.name,
         parents: [ROOT_FOLDER],
      },
      fields: FIELDS,
      media: {
         mimeType: 'application/pdf',
         body: createReadStream(file.path),
      },
      auth: jwt,
   });
   const parsed = googleDriveUploadResponse.parse(res);

   parsed.data.webViewLink = parsed.data.webViewLink.split('?')[0];

   return parsed.data;
}

async function getPDFMetadata(pdfDir: string): Promise<PDFMetadata[]> {
   const pdfMeta: PDFMetadata[] = [];

   for (
      const file of walkSync(pdfDir, {
         maxDepth: 1,
         includeDirs: false,
      })
   ) {
      if (file.isFile && file.name.endsWith('.pdf')) {
         pdfMeta.push({
            name: file.name,
            path: file.path,
         });
      }
   }
   return pdfMeta;
}

async function checkDriveForExisting(
   files: PDFMetadata[],
   jwt: JWT,
): Promise<PDFMetadata[]> {
   if (files.length === 0) {
      return files;
   }

   const [year, month, area] = files[0].name.split('__');

   const q =
      `'${ROOT_FOLDER}' in parents and name contains '${year}__${month}__' and mimeType = 'application/pdf'`;

   const fetchExisting = await drive.files.list({
      pageSize: 500,
      q,
      fields: `files(${FIELDS})`,
      spaces: 'drive',
      auth: jwt,
   });

   const existingFiles = fetchExisting.data.files;

   const parsedExistingFiles = googleDriveFileMetadata
      .array()
      .safeParse(existingFiles);

   if (!parsedExistingFiles.success) {
      return files;
   }

   // Create a map of existing files using their names as keys
   const existingFilesMap = new Map(
      parsedExistingFiles.data.map((file) => [file.name, file.id]),
   );

   // Iterate over the files array and add the id from existing files where the names match
   for (const file of files) {
      const id = existingFilesMap.get(file.name);

      if (id) {
         file.id = id;
      }
   }

   return files;
}
/*
function toPrettyName(name: string) {
   return name = "lamoreaux?name
      .replace(/_/g, " ") // Replace underscores with spaces
      .replace(/\b\w/g, (char) => char.toUpperCase());
}*/

function getMonthNumber(monthName: string) {
   const months = [
      'january',
      'february',
      'march',
      'april',
      'may',
      'june',
      'july',
      'august',
      'september',
      'october',
      'november',
      'december',
   ];

   return months.indexOf(monthName.toLowerCase()) + 1;
}

async function updateDB(metadata: GoogleDriveFileMetadata[]) {
   await backup();

   const updatedRows: Record<string, any> = [];
   const insertedRows: Record<string, any> = [];

   const checkStatement = DB.prepare(
      'SELECT id FROM pdfs WHERE year = ? AND month_name = ? AND neighbourhood_id = ?',
   );

   const neighbourhoodsStatement = DB.prepare(
      'SELECT id, name_code FROM neighbourhoods',
   );

   const neighbourhoods = neighbourhoodsStatement.all<{
      id: number;
      name_code: string;
   }>();

   neighbourhoodsStatement.finalize();

   const updateStatement = DB.prepare(
      'UPDATE pdfs SET url = ? WHERE id = ? RETURNING *',
   );

   const insertStatement = DB.prepare(
      'INSERT INTO pdfs (year, month_name, month_number, neighbourhood_id, url) VALUES (?, ?, ?, ?, ?) RETURNING *',
   );

   const runTransaction = DB.transaction((data: GoogleDriveFileMetadata[]) => {
      for (const file of data) {
         const fileName = file.name.replace('.pdf', '');
         const [year, month_name, area] = fileName.split('__');

         const neighbourhood = neighbourhoods.find((n) => n.name_code === area);

         if (!neighbourhood) {
            console.log(`Neighbourhood not found: ${area}`);
            throw new Error(
               `Neighbourhood not found: ${area}, Rolling back transaction`,
            );
         }

         const newRow: PdfInsert = {
            year: parseInt(year),
            month_name,
            month_number: getMonthNumber(month_name),
            neighbourhood_id: neighbourhood.id,
            url: file.webViewLink,
         };

         const existingRow = checkStatement.all<RowId>(
            newRow.year,
            newRow.month_name,
            newRow.neighbourhood_id,
         );

         if (existingRow.length > 0) {
            const id = existingRow[0].id;
            // Update the specific value (webViewLink) in the existing row
            const updatedRow = updateStatement.all(file.webViewLink, id);
            updatedRows.push(updatedRow[0]);
         } else {
            // Insert a new row

            const insertedRow = insertStatement.all<PdfInsert>(
               newRow.year,
               newRow.month_name,
               newRow.month_number,
               newRow.neighbourhood_id,
               newRow.url,
            );
            insertedRows.push(insertedRow[0]);
         }
      }
   });

   runTransaction(metadata);

   updateStatement.finalize();
   insertStatement.finalize();
   checkStatement.finalize();

   return { updatedRows, insertedRows };
}
