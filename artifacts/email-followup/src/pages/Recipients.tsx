import { useState, useEffect } from "react";
import { Mail, Calendar, Loader2 } from "lucide-react";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate } from "@/lib/utils";
import { useListCampaigns } from "@workspace/api-client-react";

interface Recipient {
  id: number;
  name: string;
  email: string;
  campaignId: number;
  campaignName: string;
  sentCount: number;
  initialSentAt: string | null;
}

interface Campaign {
  id: number;
  reasonId: number | null;
  reason?: {
    color: string;
  };
}

type SortField = "name" | "email" | "campaignName" | "sentCount" | "initialSentAt";
type SortOrder = "asc" | "desc";

export default function Recipients() {
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [campaignColors, setCampaignColors] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(true);
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc");
  const { data: campaigns = [] } = useListCampaigns();

  useEffect(() => {
    // Build campaign color map
    const colors: Record<number, string> = {};
    if (campaigns && campaigns.length > 0) {
      campaigns.forEach((campaign: Campaign) => {
        if (campaign.reason?.color) {
          colors[campaign.id] = campaign.reason.color;
        }
      });
    }
    setCampaignColors(colors);
  }, [campaigns.length]);

  useEffect(() => {
    fetchRecipients();
  }, []);

  const fetchRecipients = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/recipients");
      const data = await response.json();
      setRecipients(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Failed to fetch recipients:", error);
      setRecipients([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
  };

  const sortedRecipients = [...recipients].sort((a, b) => {
    const aVal = a[sortField];
    const bVal = b[sortField];

    if (aVal === null || aVal === undefined) return 1;
    if (bVal === null || bVal === undefined) return -1;

    let comparison;
    if (typeof aVal === "string") {
      comparison = aVal.toLowerCase().localeCompare(bVal.toString().toLowerCase());
    } else {
      comparison = (aVal as number) - (bVal as number);
    }

    return sortOrder === "asc" ? comparison : -comparison;
  });

  const SortHeader = ({ field, label }: { field: SortField; label: string }) => (
    <th
      onClick={() => handleSort(field)}
      className="px-4 py-3 text-left text-sm font-semibold cursor-pointer hover:bg-muted/50 transition-colors"
    >
      <div className="flex items-center gap-2">
        {label}
        {sortField === field && (
          <span className="text-xs">
            {sortOrder === "asc" ? "↑" : "↓"}
          </span>
        )}
      </div>
    </th>
  );

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground">Recipients</h1>
        <p className="text-muted-foreground text-lg">All contacts you've emailed ({recipients.length} total)</p>
      </div>

      <Card className="border-none shadow-md">
        <CardHeader>
          <CardTitle>Recipients Database</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : recipients.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">No recipients yet</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b">
                  <tr>
                    <SortHeader field="name" label="Name" />
                    <SortHeader field="email" label="Email" />
                    <SortHeader field="campaignName" label="Campaign" />
                    <SortHeader field="sentCount" label="Emails Sent" />
                    <SortHeader field="initialSentAt" label="First Sent" />
                  </tr>
                </thead>
                <tbody>
                  {sortedRecipients.map((recipient) => (
                    <tr
                      key={`${recipient.campaignId}-${recipient.id}`}
                      className="border-b hover:bg-muted/50 transition-colors"
                    >
                      <td className="px-4 py-3">
                        <Link href={`/campaigns/${recipient.campaignId}`}>
                          <div className="font-medium text-primary hover:underline cursor-pointer">
                            {recipient.name}
                          </div>
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Mail className="w-4 h-4 flex-shrink-0" />
                          <a
                            href={`mailto:${recipient.email}`}
                            className="hover:text-foreground hover:underline"
                          >
                            {recipient.email}
                          </a>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {campaignColors[recipient.campaignId] && (
                            <div
                              className="w-3 h-3 rounded-full flex-shrink-0"
                              style={{ backgroundColor: campaignColors[recipient.campaignId] }}
                            />
                          )}
                          <span>{recipient.campaignName}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="inline-block px-2 py-1 bg-primary/10 rounded text-primary font-medium">
                          {recipient.sentCount}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {recipient.initialSentAt ? (
                          <div className="flex items-center gap-1">
                            <Calendar className="w-4 h-4 flex-shrink-0" />
                            {formatDate(new Date(recipient.initialSentAt))}
                          </div>
                        ) : (
                          "-"
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
