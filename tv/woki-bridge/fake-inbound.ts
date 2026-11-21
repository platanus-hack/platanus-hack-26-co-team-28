// woki-bridge/fake-inbound.ts   uso: npx tsx --env-file=.env --env-file=.env.sandbox fake-inbound.ts "¿vienes el domingo?"
import { readFileSync } from "node:fs";
import { WapiClient } from "./wapi-sdk/index.ts";

const sb = new WapiClient({ apiKey: process.env.WAPI_API_KEY!, baseUrl: process.env.WAPI_BASE_URL });
const sofia = JSON.parse(readFileSync("profile.sandbox.json", "utf8")).contacts[0];
await sb.sandbox.inbound(process.argv[2] ?? "¿vienes el domingo?", sofia.phone.replace("+", ""));
console.log("Mensaje falso enviado desde", sofia.name);
