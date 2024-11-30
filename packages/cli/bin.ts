#!/usr/bin/env deno
import pkg from "./deno.json" with { type: "json" };
import { program } from "commander";
import { upload } from "./commands/upload.ts";
import { download } from "./commands/download.ts";

program.name(pkg.name).version(pkg.version, "-v, --version");
program.addCommand(upload).addCommand(download);
program.parse();
