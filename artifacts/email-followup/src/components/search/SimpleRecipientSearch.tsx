import { useState } from "react";
import { Search, Mail, Calendar } from "lucide-react";
import { format } from "date-fns";

interface SearchResult {
  id: number;
  name: string;
  email: string;
  campaignId: number;
  campaignName: string;
  sentCount: number;
  initialSentAt: string | null;
}

export function SimpleRecipientSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);

  const handleSearch = async (value: string) => {
    setQuery(value);

    if (!value.trim()) {
      setResults([]);
      setShowResults(false);
      return;
    }

    setLoading(true);
    setShowResults(true);

    try {
      // Direct API call
      const response = await fetch(
        `/api/search/recipients?q=${encodeURIComponent(value)}`
      );
      const data = await response.json();
      setResults(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Search error:", error);
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative w-full max-w-md">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search recipients by name or email..."
          value={query}
          onChange={(e) => handleSearch(e.target.value)}
          className="w-full pl-10 pr-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </div>

      {/* Results Dropdown */}
      {showResults && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white border rounded-lg shadow-lg z-50 max-h-96 overflow-y-auto">
          {loading && (
            <div className="p-4 text-center text-sm text-muted-foreground">
              Searching...
            </div>
          )}

          {!loading && results.length === 0 && (
            <div className="p-4 text-center text-sm text-muted-foreground">
              No recipients found
            </div>
          )}

          {results.map((result) => (
            <div
              key={`${result.campaignId}-${result.id}`}
              className="p-3 border-b hover:bg-muted/50 transition-colors last:border-b-0"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <h4 className="font-medium text-sm">{result.name}</h4>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                    <Mail className="w-3 h-3 flex-shrink-0" />
                    <span className="truncate">{result.email}</span>
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="text-sm font-medium whitespace-nowrap">
                    {result.sentCount} email{result.sentCount !== 1 ? "s" : ""}
                  </div>
                </div>
              </div>

              {/* Campaign Info */}
              <div className="mt-2 pt-2 border-t text-xs space-y-1">
                <div className="text-muted-foreground">
                  Campaign: <span className="font-medium">{result.campaignName}</span>
                </div>
                {result.initialSentAt && (
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <Calendar className="w-3 h-3 flex-shrink-0" />
                    First sent: {format(new Date(result.initialSentAt), "MMM d, yyyy")}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
