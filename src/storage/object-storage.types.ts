export type StoredObject = {
  bucket?: string;
  checksum: string;
  contentType: string;
  key: string;
  provider: string;
  size: number;
};

export type PutObjectInput = {
  body: Buffer;
  contentDisposition?: string;
  contentType: string;
  key: string;
};
