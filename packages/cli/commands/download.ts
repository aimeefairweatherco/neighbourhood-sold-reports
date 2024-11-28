import { ensureDirSync, WalkEntry, walkSync } from "@std/fs";
import { Buffer } from "node:buffer";
import { resolve } from "@std/path";
// @ts-types="npm:@types/mailparser"
import { simpleParser } from "npm:mailparser";
import pc from "npm:picocolors";
import {
   ELEMENT_NODE,
   parse,
   TEXT_NODE,
   walk,
} from "jsr:@michaelhthomas/fluxhtml";
import { Command } from "commander";
import { intro, log, outro, spinner } from "npm:@clack/prompts";

const CWD = Deno.cwd();

export const download = new Command("download")
   .description(
      "A CLI for downloading PDFs from dropbox links in emails (.eml) files",
   )
   .option("-C, --cwd <path>", "path to working directory", CWD)
   .action((options, upload: Command) => {
      const cwd: string = options.cwd;
      const args: string[] = upload.args;

      runDownload(cwd, args);
   });

export async function runDownload(cwd: string, args: string[]) {
   intro("Welcome to the Dropbox PDF Downloader");

   const s = spinner();

   const emailsDir = resolve(cwd, "data/emails");
   const outputDir = resolve(cwd, "data/pdfs");

   ensureDirSync(emailsDir);
   ensureDirSync(outputDir);

   s.start("Checking for emails to process...");
   s.message();

   const emails: WalkEntry[] = [];

   for (
      const email of walkSync(emailsDir, {
         maxDepth: 1,
         includeDirs: false,
      })
   ) {
      if (email.isFile && email.name.endsWith(".eml")) {
         emails.push(email);
      }
   }

   s.stop(
      `[${pc.bold(pc.green("DONE"))}] Found ${
         pc.cyan(emails.length)
      } emails to process`,
   );

   if (emails.length === 0) {
      outro("No emails found to process");
      Deno.exit(0);
   }

   for (const email of emails) {
      const html = await parseEmail(email.path);
      const baseMessage = `Processing email ${pc.cyan(email.name)}`;
      s.start(baseMessage);

      const prefix = `${email.name.split(".")[0].replace(/_/g, "__")}__`;

      let count = 1;
      if (html) {
         const links = await extractDropboxLinks(html);

         for (const link of links) {
            s.message(
               `${baseMessage}: (${count}/${links.length}) Downloading ${
                  pc.cyan(link.name)
               }`,
            );
            await downloadPDF(link.url, outputDir, `${prefix}${link.name}`);
            count++;
         }
      }
      s.stop(
         `[${pc.bold(pc.green("DONE"))}] Processing email ${
            pc.cyan(email.name)
         }`,
      );
   }
   outro(`All emails processed`);
   Deno.exit(0);
}

async function parseEmail(inputPath: string) {
   const emailPath = resolve(inputPath);

   const emailFile = await Deno.readFile(emailPath);

   const emailBuffer = Buffer.from(emailFile);

   const email = await simpleParser(emailBuffer);

   return email.html;
}

type DropboxLink = {
   url: string;
   name: string;
};

async function extractDropboxLinks(html: string) {
   const dom = parse(html);

   const links: DropboxLink[] = [];

   await walk(dom, (node) => {
      if (node.type === ELEMENT_NODE && node.name === "a") {
         if (!node.attributes.href.includes("dropbox")) {
            return;
         }

         const url = new URL(node.attributes.href.replace(/amp;/g, ""));

         if (url.searchParams.has("dl")) {
            url.searchParams.delete("dl");
            url.searchParams.set("raw", "1");
         }

         links.push({
            url: url.toString(),
            name: node.children[0].type === TEXT_NODE
               ? normalizeName(node.children[0].value)
               : "",
         });
      }
   });
   return links;
}
async function downloadPDF(url: string, outputPath: string, filename: string) {
   try {
      const response = await fetch(url, {
         method: "GET",
         headers: {
            "Content-Type": "application/pdf",
         },
         redirect: "follow",
      });

      if (!response.ok) {
         throw new Error(`Failed to download PDF from ${url}`);
      }

      const path = resolve(outputPath, `${filename}.pdf`);

      const fileStream = await Deno.open(path, {
         write: true,
         create: true,
      });
      const reader = response.body?.getReader();

      if (!reader) {
         throw new Error(`Failed to get reader from response body for ${url}`);
      }

      const writer = fileStream.writable.getWriter();

      while (true) {
         const { done, value } = await reader.read();
         if (done) {
            break;
         }
         await writer.write(value);
      }

      await writer.close();
   } catch (error) {
      // TODO: Error handling
      console.error(`Failed to download ${filename} PDF from ${url}: ${error}`);
   }
}

function normalizeName(name: string) {
   return name
      .replace(/\n/g, "")
      .replace(/ - | – /g, "-")
      .replace(/ /g, "_")
      .replace(/\./g, "")
      .replace(/’|'/g, "")
      .toLowerCase();
}