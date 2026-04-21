interface EmailPreviewProps {
  subject: string;
  body: string;
  fontSize: string;
  fontFamily: string;
  lineHeight: string;
  footerName?: string;
  footerTitle?: string;
  footerImageUrl?: string;
  footerWebsite?: string;
  footerWebsiteUrl?: string;
  footerFacebook?: string;
  footerInstagram?: string;
  footerYoutube?: string;
}

export function EmailPreview({
  subject,
  body,
  fontSize,
  fontFamily,
  lineHeight,
  footerName,
  footerTitle,
  footerImageUrl,
  footerWebsite,
  footerWebsiteUrl,
  footerFacebook,
  footerInstagram,
  footerYoutube,
}: EmailPreviewProps) {
  return (
    <div className="border rounded-xl bg-white p-8 text-foreground max-h-96 overflow-y-auto">
      <div style={{ fontSize: `${fontSize}px`, fontFamily, lineHeight }}>
        <h2 style={{ fontSize: `${parseInt(fontSize) * 1.3}px` }} className="font-bold mb-4">{subject || "Subject line appears here"}</h2>
        <div 
          className="prose prose-sm dark:prose-invert max-w-none mb-6"
          dangerouslySetInnerHTML={{ __html: body || "<p>Email body appears here</p>" }}
        />

        {footerName && (
          <div className="border-t pt-6 mt-6">
            <div className="flex gap-4 items-start">
              {footerImageUrl && (
                <img
                  src={footerImageUrl}
                  alt={footerName}
                  className="w-14 h-14 md:w-20 md:h-20 rounded-full object-cover flex-shrink-0"
                />
              )}
              <div className="flex flex-col min-w-0">
                <p className="font-bold text-primary">{footerName}</p>
                {footerTitle && <p className="text-sm font-semibold">{footerTitle}</p>}
                {footerWebsite && (
                  <a href={footerWebsiteUrl} className="text-sm text-primary hover:underline break-all">
                    {footerWebsite}
                  </a>
                )}
                {(footerFacebook || footerInstagram || footerYoutube) && (
                  <div className="flex gap-2 mt-2">
                    {footerFacebook && (
                      <a href={`https://facebook.com/${footerFacebook}`} className="text-xs px-2 py-1 border border-primary text-primary rounded flex items-center justify-center">
                        f
                      </a>
                    )}
                    {footerInstagram && (
                      <a href={`https://instagram.com/${footerInstagram}`} className="text-xs px-2 py-1 border border-primary text-primary rounded flex items-center justify-center">
                        @
                      </a>
                    )}
                    {footerYoutube && (
                      <a href={`https://youtube.com/${footerYoutube}`} className="text-xs px-2 py-1 border border-primary text-primary rounded flex items-center justify-center">
                        ▶
                      </a>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
