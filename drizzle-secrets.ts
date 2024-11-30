import { env } from './env.ts';

const secrets = await env;

console.log(JSON.stringify(secrets));
