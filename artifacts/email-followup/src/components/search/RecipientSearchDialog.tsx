import { useState } from "react";
import { Search, X, Mail, Calendar } from "lucide-react";
import { Button } from "../ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../ui/dialog";
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

export function RecipientSearchDialog() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);

  const handleInputChange = async (value: string) => {
    setQuery(value);

    if (!value.trim()) {
      setResults([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const baseUrl = import.meta.env.BASE_URL || "/";
      const url = `${baseUrl}api/search/recipients?q=${encodeURIComponent(value)}`;
      console.log("Fetching from:", url);
      
      const response = await fetch(url);
      const data = await response.json();
      
      console.log("Response data:", data);
      setResults(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Search error:", error);
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Search className="w-4 h-4" />
          Search Recipients
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Search Recipients</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Search Input */}
          <div className="relative">
            <input
              type="text"
              placeholder="Search by name or email..."
              value={query}
              onChange={(e) => handleInputChange(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              autoFocus
            />
            {query && (
              <button
                onClick={() => handleInputChange("")}
                className="absolute right-3 top-1/2 -translate-y-1/2"
              >
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            )}
          </div>

          {/* Loading State */}
          {loading && (
            <div className="text-center py-4 text-sm text-muted-foreground">
              Searching...
            </div>
          )}

          {/* Empty State */}
          {!loading && query && results.length === 0 && (
            <div className="text-center py-4 text-sm text-muted-foreground">
              No recipients found
            </div>
          )}

          {/* Empty Initial State */}
          {!query && results.length === 0 && !loading && (
            <div className="text-center py-4 text-sm text-muted-foreground">
              Start typing to search for a recipient by name or email
            </div>
          )}

          {/* Results */}
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {results.map((result) => (
              <div
                key={`${result.campaignId}-${result.id}`}
                className="p-3 border rounded-lg hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h4 className="font-medium text-sm">{result.name}</h4>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                      <Mail className="w-3 h-3" />
                      {result.email}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium">
                      {result.sentCount} email{result.sentCount !== 1 ? "s" : ""}
                    </div>
                  </div>
                </div>

                {/* Campaign Info */}
                <div className="mt-2 pt-2 border-t text-xs">
                  <div className="text-muted-foreground">
                    Campaign: <span className="font-medium">{result.campaignName}</span>
                  </div>
                  {result.initialSentAt && (
                    <div className="flex items-center gap-1 text-muted-foreground mt-1">
                      <Calendar className="w-3 h-3" />
                      First sent: {format(new Date(result.initialSentAt), "MMM d, yyyy")}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
