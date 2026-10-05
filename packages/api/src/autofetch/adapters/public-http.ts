import { lookup as dnsLookup } from "node:dns/promises";
import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";
import { isIP } from "node:net";
import type { LookupFunction } from "node:net";
import type { IncomingMessage } from "node:http";
import { AdapterError } from "../types/index.js";

const MAX_REDIRECTS = 3;

function isPublicIp(address: string): boolean {
  const family = isIP(address);
  if (family === 4) {
    const octets = address.split(".").map(Number);
    const value = octets.reduce((result, octet) => result * 256 + octet, 0);
    const inRange = (range: string, bits: number) => {
      const base = range.split(".").map(Number).reduce((result, octet) => result * 256 + octet, 0);
      return Math.floor(value / 2 ** (32 - bits)) === Math.floor(base / 2 ** (32 - bits));
    };
    return ![
      ["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8],
      ["169.254.0.0", 16], ["172.16.0.0", 12], ["192.0.0.0", 24], ["192.0.2.0", 24],
      ["192.168.0.0", 16], ["198.18.0.0", 15], ["198.51.100.0", 24], ["203.0.113.0", 24],
      ["224.0.0.0", 4], ["240.0.0.0", 4],
    ].some(([range, bits]) => inRange(String(range), Number(bits)));
  }
  if (family !== 6) return false;

  const normalized = address.toLowerCase();
  return !(
    normalized === "::" ||
    normalized === "::1" ||
    normalized.startsWith("::ffff:") ||
    /^f[cd]/.test(normalized) ||
    /^fe[89ab]/.test(normalized) ||
    normalized.startsWith("ff") ||
    normalized.startsWith("2001:db8:")
  );
}

export function validatePublicSourceUrl(value: string): URL {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("A public HTTP(S) source URL is required");
  }
  const hostname = url.hostname.toLowerCase();
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.hash ||
    (url.port && !((url.protocol === "http:" && url.port === "80") || (url.protocol === "https:" && url.port === "443"))) ||
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local") ||
    hostname.endsWith(".internal") ||
    (isIP(hostname) !== 0 && !isPublicIp(hostname))
  ) {
    throw new Error("Source URL must use a public HTTP(S) endpoint without credentials or a nonstandard port");
  }
  return url;
}

function request(url: URL, headers: Record<string, string>, timeoutMs: number): Promise<IncomingMessage> {
  return new Promise((resolve, reject) => {
    const hostname = url.hostname.replace(/^\[|\]$/g, "");
    const dnsTimer = setTimeout(() => reject(new AdapterError("Source hostname resolution timed out", "FETCH_FAILED")), timeoutMs);
    void dnsLookup(hostname, { all: true, verbatim: true }).then((addresses) => {
      clearTimeout(dnsTimer);
      if (!addresses.length || addresses.some(({ address }) => !isPublicIp(address))) {
        throw new AdapterError("Source hostname resolves to a private or reserved address", "URL_BLOCKED");
      }
      const address = addresses[0]!;
      const lookup: LookupFunction = (_host, options, callback) => {
        if (options.all) {
          callback(null, [{ address: address.address, family: address.family }]);
        } else {
          callback(null, address.address, address.family);
        }
      };
      const transport = url.protocol === "https:" ? httpsRequest : httpRequest;
      const req = transport(url, {
        method: "GET",
        lookup,
        servername: isIP(hostname) ? undefined : hostname,
        headers: { ...headers, "Accept-Encoding": "identity" },
      }, resolve);
      req.setTimeout(timeoutMs, () => req.destroy(new Error("Source request timed out")));
      req.once("error", reject);
      req.end();
    }).catch((error: unknown) => {
      clearTimeout(dnsTimer);
      reject(error);
    });
  });
}

export async function fetchPublicSource(
  inputUrl: string,
  options: {
    timeoutMs: number;
    maxBytes: number;
    headers?: Record<string, string>;
    acceptedContentType?: (contentType: string) => boolean;
  },
): Promise<{ body: Buffer; contentType: string }> {
  let url = validatePublicSourceUrl(inputUrl);
  let headers = { ...options.headers };

  for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects += 1) {
    const response = await request(url, headers, options.timeoutMs);
    const status = response.statusCode ?? 0;
    if ([301, 302, 303, 307, 308].includes(status)) {
      const location = response.headers.location;
      response.resume();
      if (!location) throw new AdapterError("Source redirect omitted its target", "FETCH_FAILED");
      const nextUrl = validatePublicSourceUrl(new URL(location, url).href);
      if (nextUrl.origin !== url.origin) {
        headers = Object.fromEntries(Object.entries(headers).filter(([key]) => !["authorization", "cookie", "proxy-authorization"].includes(key.toLowerCase())));
      }
      url = nextUrl;
      continue;
    }
    if (status < 200 || status >= 300) {
      response.resume();
      throw new AdapterError(`Source returned HTTP ${status}`, "FETCH_FAILED", { status });
    }

    const contentType = response.headers["content-type"]?.toLowerCase() ?? "";
    if (options.acceptedContentType && !options.acceptedContentType(contentType)) {
      response.resume();
      throw new AdapterError("Source returned an unsupported content type", "INVALID_FORMAT", { contentType });
    }

    const declaredLength = Number(response.headers["content-length"] ?? 0);
    if (declaredLength > options.maxBytes) {
      response.resume();
      throw new AdapterError("Source response exceeds the configured size limit", "RESPONSE_TOO_LARGE");
    }

    const body = await new Promise<Buffer>((resolve, reject) => {
      const chunks: Buffer[] = [];
      let totalBytes = 0;
      response.on("data", (chunk: Buffer | string) => {
        const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        totalBytes += buffer.length;
        if (totalBytes > options.maxBytes) {
          response.destroy(new Error("Source response exceeds the configured size limit"));
          reject(new AdapterError("Source response exceeds the configured size limit", "RESPONSE_TOO_LARGE"));
          return;
        }
        chunks.push(buffer);
      });
      response.once("end", () => resolve(Buffer.concat(chunks)));
      response.once("error", reject);
    });
    return { body, contentType };
  }

  throw new AdapterError("Too many redirects from source", "FETCH_FAILED");
}
