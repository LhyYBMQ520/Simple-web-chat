import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import crypto from 'node:crypto';
import {
  STORAGE_ENDPOINT,
  STORAGE_BUCKET,
  STORAGE_ACCESS_KEY,
  STORAGE_SECRET_KEY,
  STORAGE_PUBLIC_URL,
  STORAGE_REGION,
  UPLOAD_URL_EXPIRY
} from '../config/constants.js';

export interface PresignedUploadResult {
  uploadUrl: string;
  publicUrl: string;
  fileKey: string;
}

export interface StorageService {
  generateUploadUrl(fileName: string, contentType: string): Promise<PresignedUploadResult>;
  deleteFile(fileKey: string): Promise<void>;
  isConfigured(): boolean;
}

function normalizePublicUrl(raw: string): string {
  if (!raw) return '';
  return raw.replace(/\/+$/, '');
}

export function createStorageService(): StorageService {
  const publicUrl = normalizePublicUrl(STORAGE_PUBLIC_URL);
  const configured = !!(STORAGE_ACCESS_KEY && STORAGE_SECRET_KEY && STORAGE_BUCKET);

  const client = configured
    ? new S3Client({
        region: STORAGE_REGION,
        endpoint: STORAGE_ENDPOINT || undefined,
        credentials: {
          accessKeyId: STORAGE_ACCESS_KEY,
          secretAccessKey: STORAGE_SECRET_KEY
        },
        forcePathStyle: false
      })
    : null;

  function isConfigured(): boolean {
    return configured;
  }

  function generateFileKey(fileName: string): string {
    const date = new Date();
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    const random = crypto.randomBytes(8).toString('hex');
    const ext = fileName.includes('.') ? fileName.substring(fileName.lastIndexOf('.')) : '';
    const safeName = fileName
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .substring(0, 64);
    return `chat/${y}/${m}/${d}/${random}_${safeName}`;
  }

  async function generateUploadUrl(fileName: string, contentType: string): Promise<PresignedUploadResult> {
    if (!client) {
      throw new Error('对象存储未配置，请设置环境变量');
    }

    const fileKey = generateFileKey(fileName);

    const encodedName = encodeURIComponent(fileName)
      .replace(/['()*]/g, c => '%' + c.charCodeAt(0).toString(16).toUpperCase());
    const disposition = `attachment; filename*=UTF-8''${encodedName}`;

    const uploadUrl = await getSignedUrl(
      client,
      new PutObjectCommand({
        Bucket: STORAGE_BUCKET,
        Key: fileKey,
        ContentType: contentType,
        ContentDisposition: disposition
      }),
      { expiresIn: UPLOAD_URL_EXPIRY }
    );

    const needsBucketPath = publicUrl
      && publicUrl.includes('r2.dev')
      && !publicUrl.endsWith('/' + STORAGE_BUCKET);

    const baseUrl = publicUrl
      ? (needsBucketPath ? `${publicUrl}/${STORAGE_BUCKET}` : publicUrl)
      : `${STORAGE_ENDPOINT}/${STORAGE_BUCKET}`;
    const finalPublicUrl = `${baseUrl}/${fileKey}`;

    return {
      uploadUrl: uploadUrl.toString(),
      publicUrl: finalPublicUrl,
      fileKey,
      headers: { 'Content-Disposition': disposition }
    } as PresignedUploadResult & { headers: Record<string, string> };
  }

  async function deleteFile(fileKey: string): Promise<void> {
    if (!client) return;

    await client.send(
      new DeleteObjectCommand({
        Bucket: STORAGE_BUCKET,
        Key: fileKey
      })
    );
  }

  return {
    generateUploadUrl,
    deleteFile,
    isConfigured
  };
}
