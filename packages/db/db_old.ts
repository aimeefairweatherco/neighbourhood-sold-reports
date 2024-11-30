import { Database } from '@db/sqlite';
import { copy, ensureDir } from '@std/fs';
import { basename, resolve } from '@std/path';

const cwd = Deno.cwd();
const dbDir = resolve(cwd, 'data/db');

export type RowId = {
   id: number;
};

export type PdfInsert = {
   year: number;
   month_name: string;
   month_number: number;
   neighbourhood_id: number;
   url: string;
};

export type PdfRow = PdfInsert & RowId;

export type RegionInsert = {
   name: string;
   color: string;
};

export type RegionRow = RegionInsert & RowId;

export type NeighbourhoodInsert = {
   name_code: string;
   name_pretty: string;
   polygon_data: string;
   region_id: number;
};

export type NeighbourhoodRow = NeighbourhoodInsert & RowId;

async function db(create: boolean = false) {
   try {
      if (create) {
         await ensureDir(dbDir);

         const db = new Database(resolve(dbDir, 'data.db'), { create: true });

         db.exec(`
                    CREATE TABLE if not exists regions (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        name TEXT NOT NULL,
                        color TEXT NOT NULL
                    )
            `);

         db.exec(
            `INSERT INTO regions (name, color) VALUES
                ('Downtown', '#0f9d58'),
                ('Midtown', '#0288d1'),
                ('North Toronto', '#880e4f'),
                ('East End', '#0097a7'),
                ('West End', '#ffea00'),
                ('East York', '#1a237e'),
                ('York - Crosstown', '#ff5252'),
                ('North York', '#f57c00'),
                ('Scarborough', '#673ab7'),
                ('Etobicoke', '#795548')
            `,
         );

         db.exec(`
                CREATE TABLE neighbourhoods (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name_code TEXT NOT NULL,
                    name_pretty TEXT NOT NULL,
                    polygon_data TEXT NOT NULL,
                    region_id INTEGER NOT NULL,
                    FOREIGN KEY (region_id) REFERENCES regions (id)
                )
        `);

         db.exec(`
                    CREATE TABLE IF NOT EXISTS pdf_urls (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        year INTEGER NOT NULL,
                        month_name TEXT NOT NULL,
                        month_number INTEGER NOT NULL,
                        neighbourhood_id INTEGER,
                        area TEXT NOT NULL,
                        pretty_area TEXT NOT NULL,
                        url TEXT NOT NULL,
                        FOREIGN KEY (neighbourhood_id) REFERENCES neighbourhoods (id)
                    )`);

         db.exec(`
            CREATE UNIQUE INDEX idx_pdf_urls_year_month_area on pdf_urls (year, month_name, area)
        `);

         return db;
      }

      return new Database(resolve(dbDir, 'data.db'), { create: false });
   } catch (e) {
      throw e;
   }
}

type LatLng = {
   lat: number;
   lng: number;
};

function parseLatLongString(latLongString: string): LatLng[] {
   let normalized = latLongString.replace(/\),\(/g, '_').replace(/\(/g, '')
      .replace(/\)/g, '');

   if (normalized.endsWith(',')) {
      normalized = normalized.slice(0, -1);
   }
   return normalized.split('_').map((pair) => {
      const [lat, long] = pair.split(',');
      return {
         lat: parseFloat(lat),
         lng: parseFloat(long),
      };
   });
}

async function backup() {
   try {
      const database = await db();
      const name = basename(database.path);
      const backupPath = resolve(dbDir, 'backup');
      await ensureDir(backupPath);
      const backupFile = resolve(backupPath, name);

      await copy(database.path, backupFile, { overwrite: true });
   } catch (error) {
      console.error(`Error backing up database: ${error}`);
   }
}

export { backup, db };
