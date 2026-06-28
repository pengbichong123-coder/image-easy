import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const DEFAULT_SIGNED_URL_TTL_SECONDS = 3600;

type R2Config = {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucketName: string;
  publicBaseUrl?: string;
  signedUrlTtlSeconds: number;
};

function requiredEnv(name: string) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`Missing required R2 environment variable: ${name}`);
  }

  return value;
}

function parseSignedUrlTtl() {
  const rawValue = process.env.R2_SIGNED_URL_TTL_SECONDS?.trim();

  if (!rawValue) {
    return DEFAULT_SIGNED_URL_TTL_SECONDS;
  }

  if (!/^\d+$/.test(rawValue)) {
    throw new Error("R2_SIGNED_URL_TTL_SECONDS must be a positive integer");
  }

  const ttl = Number.parseInt(rawValue, 10);

  if (!Number.isFinite(ttl) || ttl <= 0) {
    throw new Error("R2_SIGNED_URL_TTL_SECONDS must be a positive integer");
  }

  return ttl;
}

function getR2Config(): R2Config {
  const publicBaseUrl = process.env.R2_PUBLIC_BASE_URL?.trim().replace(/\/+$/, "");

  return {
    accountId: requiredEnv("R2_ACCOUNT_ID"),
    accessKeyId: requiredEnv("R2_ACCESS_KEY_ID"),
    secretAccessKey: requiredEnv("R2_SECRET_ACCESS_KEY"),
    bucketName: requiredEnv("R2_BUCKET_NAME"),
    publicBaseUrl: publicBaseUrl || undefined,
    signedUrlTtlSeconds: parseSignedUrlTtl(),
  };
}

function createR2Client(config: R2Config) {
  return new S3Client({
    region: "auto",
    endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });
}

function publicAssetUrl(config: R2Config, key: string) {
  if (!config.publicBaseUrl) {
    return undefined;
  }

  const encodedKey = key.split("/").map(encodeURIComponent).join("/");
  return `${config.publicBaseUrl}/${encodedKey}`;
}

export async function putObjectToR2(input: {
  key: string;
  body: Buffer | Uint8Array;
  contentType: string;
}): Promise<{ bucket: string; key: string; url?: string }> {
  const config = getR2Config();
  const client = createR2Client(config);

  await client.send(
    new PutObjectCommand({
      Bucket: config.bucketName,
      Key: input.key,
      Body: input.body,
      ContentType: input.contentType,
    }),
  );

  const result: { bucket: string; key: string; url?: string } = {
    bucket: config.bucketName,
    key: input.key,
  };
  const url = publicAssetUrl(config, input.key);

  if (url) {
    result.url = url;
  }

  return result;
}

export async function copyRemoteImageToR2(input: {
  sourceUrl: string;
  key: string;
}): Promise<{ bucket: string; key: string; url?: string; size: number; mimeType: string }> {
  const response = await fetch(input.sourceUrl);

  if (!response.ok) {
    throw new Error(
      `Failed to fetch remote image from ${input.sourceUrl}: ${response.status} ${response.statusText}`,
    );
  }

  const mimeType = response.headers.get("content-type")?.split(";")[0]?.trim() || "application/octet-stream";
  const body = Buffer.from(await response.arrayBuffer());
  const upload = await putObjectToR2({
    key: input.key,
    body,
    contentType: mimeType,
  });

  return {
    ...upload,
    size: body.byteLength,
    mimeType,
  };
}

export async function getSignedAssetUrl(key: string): Promise<string> {
  const config = getR2Config();
  const client = createR2Client(config);

  return getSignedUrl(
    client,
    new GetObjectCommand({
      Bucket: config.bucketName,
      Key: key,
    }),
    {
      expiresIn: config.signedUrlTtlSeconds,
    },
  );
}
