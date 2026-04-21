import { useParams, Link } from "wouter";
import { useGetCampaign } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmailPreview } from "@/components/emails/EmailPreview";
import { ArrowLeft, RefreshCw } from "lucide-react";
import { useSearchParams } from "wouter";

const VIEWPORT_SIZES = [
  { label: "Mobile", width: 375 },
  { label: "Tablet", width: 768 },
  { label: "Desktop", width: 1024 },
];

export default function ResponsivePreview() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const campaignId = parseInt(id || "0");
  const stepNumber = searchParams.get("step") ? parseInt(searchParams.get("step")!) : undefined;
  const { data: campaign, isLoading, error, refetch } = useGetCampaign(campaignId);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Skeleton className="w-8 h-8" />
          <Skeleton className="h-6 w-64" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-96" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !campaign) {
    return (
      <div className="text-center py-8">
        <p className="text-red-500 mb-4">Campaign not found</p>
        <Link href="/campaigns">
          <Button variant="outline">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Campaigns
          </Button>
        </Link>
      </div>
    );
  }

  // Get the email content to preview
  const previewStep = stepNumber && campaign.followUpSteps 
    ? campaign.followUpSteps.find(s => s.stepNumber === stepNumber)
    : null;
  
  const subject = previewStep ? previewStep.subject : campaign.subject;
  const body = previewStep ? previewStep.body : campaign.body;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link href={`/campaigns/${campaignId}`}>
            <Button variant="ghost" size="sm">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">{campaign.name}</h1>
            <p className="text-sm text-gray-500">
              {previewStep ? `Follow-up #${stepNumber} Preview` : "Initial Email Preview"}
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          className="gap-2"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {VIEWPORT_SIZES.map(({ label, width }) => (
          <div key={label} className="space-y-2">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-sm">{label}</h2>
              <p className="text-xs text-gray-500">{width}px</p>
            </div>
            <Card className="border border-gray-200">
              <CardContent className="p-0 overflow-hidden bg-gray-50">
                <div
                  style={{
                    width: `${width}px`,
                    maxWidth: "100%",
                    margin: "0 auto",
                  }}
                  className="bg-white"
                >
                  <div className="p-4">
                    <EmailPreview
                      subject={subject}
                      body={body}
                      fontSize={campaign.emailFontSize || "16"}
                      fontFamily={campaign.emailFontFamily || "sans-serif"}
                      lineHeight={campaign.emailLineHeight || "1.6"}
                      footerName={campaign.footerName}
                      footerTitle={campaign.footerTitle}
                      footerImageUrl={campaign.footerImageUrl}
                      footerWebsite={campaign.footerWebsite}
                      footerWebsiteUrl={campaign.footerWebsiteUrl}
                      footerFacebook={campaign.footerFacebook}
                      footerInstagram={campaign.footerInstagram}
                      footerYoutube={campaign.footerYoutube}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        ))}
      </div>

      <div className="text-sm text-gray-500 p-4 bg-blue-50 rounded-lg">
        <p>💡 <strong>Tip:</strong> The preview updates automatically when you save changes. Use this to check how your email looks on different devices before sending.</p>
      </div>
    </div>
  );
}
