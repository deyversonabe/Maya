import { afterEach, describe, expect, it } from "vitest";
import { normalizeAllowedAttachmentUrl } from "../app/api/_shared/attachment-url";

const originalSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const originalBucket = process.env.NEXT_PUBLIC_MAYA_ATTACHMENTS_BUCKET;

afterEach(() => {
  if (originalSupabaseUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  else process.env.NEXT_PUBLIC_SUPABASE_URL = originalSupabaseUrl;

  if (originalBucket === undefined) delete process.env.NEXT_PUBLIC_MAYA_ATTACHMENTS_BUCKET;
  else process.env.NEXT_PUBLIC_MAYA_ATTACHMENTS_BUCKET = originalBucket;
});

describe("normalizeAllowedAttachmentUrl", () => {
  it("accepts only a signed PDF URL from the configured attachments bucket", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://project.supabase.co";
    process.env.NEXT_PUBLIC_MAYA_ATTACHMENTS_BUCKET = "maya-finance-attachments";
    const url = "https://project.supabase.co/storage/v1/object/sign/maya-finance-attachments/workspace/nota.pdf?token=abc";

    expect(normalizeAllowedAttachmentUrl(url)).toBe(url);
  });

  it("rejects another host, bucket, unsigned path, missing token or non-PDF file", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://project.supabase.co";
    process.env.NEXT_PUBLIC_MAYA_ATTACHMENTS_BUCKET = "maya-finance-attachments";

    expect(
      normalizeAllowedAttachmentUrl(
        "https://evil.example/storage/v1/object/sign/maya-finance-attachments/workspace/nota.pdf?token=abc"
      )
    ).toBeUndefined();
    expect(
      normalizeAllowedAttachmentUrl("https://project.supabase.co/storage/v1/object/sign/private-bucket/nota.pdf?token=abc")
    ).toBeUndefined();
    expect(
      normalizeAllowedAttachmentUrl("https://project.supabase.co/storage/v1/object/public/maya-finance-attachments/nota.pdf")
    ).toBeUndefined();
    expect(
      normalizeAllowedAttachmentUrl("https://project.supabase.co/storage/v1/object/sign/maya-finance-attachments/nota.pdf")
    ).toBeUndefined();
    expect(
      normalizeAllowedAttachmentUrl(
        "https://project.supabase.co/storage/v1/object/sign/maya-finance-attachments/nota.jpg?token=abc"
      )
    ).toBeUndefined();
  });
});
